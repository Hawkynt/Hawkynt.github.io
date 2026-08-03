/**
 * PythonTransformer.js - IL AST to Python AST Transformer
 * Converts IL AST (type-inferred, language-agnostic) to Python AST
 * (c)2006-2025 Hawkynt
 *
 * Full Pipeline:
 *   JS Source → Parser → JS AST → IL Transformer → IL AST → Language Transformer → Language AST → Language Emitter → Language Source
 *
 * This transformer handles: IL AST → Python AST
 *
 * IL AST characteristics:
 *   - Type-inferred (no untyped nodes)
 *   - Language-agnostic (no JS-specific constructs like UMD, IIFE, Math.*, Object.*, etc.)
 *   - Global options already applied
 *
 * Language options (applied here and in emitter):
 *   - addTypeHints: Include Python type hints
 *   - addDocstrings: Include docstrings
 *   - strictTypes: Enable strict type checking mode
 */

(function(global) {
  'use strict';

  // Load dependencies
  let PythonAST;
  if (typeof require !== 'undefined') {
    PythonAST = require('./PythonAST.js');
  } else if (global.PythonAST) {
    PythonAST = global.PythonAST;
  }

  const {
    PythonType, PythonModule, PythonImport, PythonClass, PythonFunction,
    PythonParameter, PythonBlock, PythonAssignment, PythonExpressionStatement,
    PythonReturn, PythonIf, PythonFor, PythonWhile, PythonBreak, PythonContinue,
    PythonRaise, PythonTryExcept, PythonExceptClause, PythonPass, PythonDelete,
    PythonLiteral, PythonFString, PythonIdentifier, PythonBinaryExpression, PythonUnaryExpression,
    PythonMemberAccess, PythonSubscript, PythonCall, PythonList, PythonDict,
    PythonTuple, PythonListComprehension, PythonGeneratorExpression, PythonConditional, PythonLambda, PythonSlice
  } = PythonAST;

  /**
   * AlgorithmFramework.js base Algorithm/Instance class names. These are
   * always emitted as bare top-level stub classes (see
   * PythonTransformer#generateFrameworkStubs), never as attributes on the
   * AlgorithmFramework stub object - so a reference like
   * `AlgorithmFramework.AeadAlgorithm` (a common
   * `var AeadAlgorithm = AlgorithmFramework.AeadAlgorithm;` extraction idiom)
   * must resolve to the bare `AeadAlgorithm` identifier, not an attribute
   * access on `AlgorithmFramework` (which has no such attribute and raises
   * AttributeError). Shared between generateFrameworkStubs() (which stubs
   * every name here) and transformMemberExpression() (which must recognize
   * every one of the same names) so the two lists can't drift apart.
   */
  const FRAMEWORK_ALGORITHM_BASES = [
    'Algorithm', 'CryptoAlgorithm', 'SymmetricCipherAlgorithm', 'AsymmetricCipherAlgorithm',
    'AsymmetricAlgorithm', 'BlockCipherAlgorithm', 'StreamCipherAlgorithm', 'EncodingAlgorithm',
    'CompressionAlgorithm', 'ErrorCorrectionAlgorithm', 'HashFunctionAlgorithm', 'MacAlgorithm',
    'KdfAlgorithm', 'PaddingAlgorithm', 'CipherModeAlgorithm', 'AeadAlgorithm',
    'RandomGenerationAlgorithm',
  ];
  const FRAMEWORK_INSTANCE_BASES = [
    'IAlgorithmInstance', 'IBlockCipherInstance', 'IStreamCipherInstance', 'IHashFunctionInstance',
    'IMacInstance', 'IKdfInstance', 'IAeadInstance', 'IErrorCorrectionInstance',
    'IRandomGeneratorInstance', 'IEncodingInstance', 'ICompressionInstance', 'ICipherModeInstance',
    'IPaddingInstance',
  ];

  /**
   * Maps JavaScript/JSDoc types to Python types
   */
  const TYPE_MAP = {
    // Unsigned integers -> int (Python 3 has arbitrary precision int)
    'uint8': 'int', 'byte': 'int',
    'uint16': 'int', 'ushort': 'int', 'word': 'int',
    'uint32': 'int', 'uint': 'int', 'dword': 'int',
    'uint64': 'int', 'ulong': 'int', 'qword': 'int',
    // Signed integers -> int
    'int8': 'int', 'sbyte': 'int',
    'int16': 'int', 'short': 'int',
    'int32': 'int', 'int': 'int',
    'int64': 'int', 'long': 'int',
    // Floating point
    'float': 'float', 'float32': 'float',
    'double': 'float', 'float64': 'float',
    'number': 'int', // In crypto context, typically int
    // Other
    'boolean': 'bool', 'bool': 'bool',
    'string': 'str', 'String': 'str',
    'void': 'None',
    'object': 'Any', 'Object': 'Any', 'any': 'Any',
    // Arrays
    'Array': 'List', 'array': 'List'
  };

  /**
   * Python reserved keywords that must be escaped
   */
  const PYTHON_RESERVED_WORDS = new Set([
    'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
    'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from',
    'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not',
    'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
    // Also include built-in names that shouldn't be shadowed
    'False', 'None', 'True',
    // Common builtins that should not be shadowed
    'len', 'str', 'int', 'float', 'bool', 'list', 'dict', 'set', 'tuple',
    'bytes', 'bytearray', 'range', 'type', 'chr', 'ord', 'hex', 'bin', 'oct',
    'abs', 'min', 'max', 'sum', 'round', 'pow', 'sorted', 'reversed',
    'map', 'filter', 'zip', 'enumerate', 'all', 'any', 'print', 'input',
    'open', 'file', 'id', 'hash', 'iter', 'next', 'slice', 'object', 'super'
  ]);

  /**
   * Escape Python reserved words by adding underscore suffix
   */
  function escapePythonReserved(name) {
    if (PYTHON_RESERVED_WORDS.has(name)) {
      return name + '_';
    }
    return name;
  }

  /**
   * True Python syntactic keywords only (not builtin names like 'input'/'type'/'list').
   * Unlike PYTHON_RESERVED_WORDS, shadowing a builtin via an attribute name
   * (obj.input, obj.type) is perfectly legal Python - only real keywords are
   * forbidden after a dot (obj.class is a SyntaxError).
   */
  const PYTHON_KEYWORDS_ONLY = new Set([
    'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
    'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from',
    'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not',
    'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
    'False', 'None', 'True'
  ]);
  function escapePythonKeyword(name) {
    if (PYTHON_KEYWORDS_ONLY.has(name)) {
      return name + '_';
    }
    return name;
  }

  /**
   * Convert camelCase to snake_case
   */
  function toSnakeCase(str) {
    // Single uppercase letters are likely constants (K, M, N, etc.) - preserve as uppercase
    if (str.length === 1 && str === str.toUpperCase()) {
      return escapePythonReserved(str);
    }

    // Preserve any all-uppercase identifier (single-word constants like MD5/
    // SHA1/SBOX/RC just as much as SCREAMING_SNAKE_CASE ones like KEY_BYTES/
    // BLOCK_SIZE) verbatim instead of lowercasing it - that's already a
    // valid, idiomatic Python identifier (Python's own convention is
    // UPPER_SNAKE_CASE / ALL-CAPS for module-level constants), and
    // lowercasing it collapses it onto whatever a *different*, camelCase (or
    // plain lowercase) identifier in the same scope also snake_cases to.
    // Originally this preservation only applied to names already containing
    // an underscore (e.g. gost28147mac.js's key setter has both the module
    // constant `KEY_BYTES` and a same-named-once-lowercased parameter
    // `keyBytes` - both used to become the single Python name `key_bytes`,
    // so the parameter silently shadowed the constant and `keyBytes.length
    // !== KEY_BYTES` always compared a length against itself instead of the
    // real 32-byte limit, permanently failing every key-size check) - but a
    // single-word all-caps name (no underscore) hit the identical collision
    // just as often: mantis.js's `const sbox = inverse ? INV_SBOX : SBOX;`
    // (a local `sbox` and the module constant `SBOX` - two distinct JS
    // identifiers) both folded to the same Python name `sbox`, so the
    // assignment's own RHS read of `SBOX` resolved to the not-yet-assigned
    // local instead of the module constant - Python's "a name assigned
    // anywhere in a function is local throughout it" rule then raised
    // "cannot access local variable 'sbox'" instead of returning the
    // constant (same root cause hit forkae.js/forkskinny.js's `const rc =
    // RC[round]` and dsfmt.js's `const msk1 = BigInt(MSK1)`). Preserving the
    // case keeps every such pair apart with no risk of a *new* collision:
    // nothing this function already lowercases could produce an all-caps
    // name to clash with.
    if (str === str.toUpperCase()) {
      return escapePythonReserved(str);
    }

    const result = str
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .replace(/([a-z\d])([A-Z])/g, '$1_$2')
      .toLowerCase();

    return escapePythonReserved(result);
  }

  /**
   * Convert camelCase to snake_case for object property / attribute names
   * (dict keys, dot-access member names). Unlike toSnakeCase(), this only
   * escapes true syntactic keywords, not shadowable builtins like 'input' or
   * 'type' - those are valid Python attribute names and several test-vector
   * fields (input/expected/key/type) rely on being left untouched so the
   * fixed-contract test harnesses (which read t.input / t.expected literally)
   * can find them.
   */
  function toSnakeCaseProperty(str) {
    if (typeof str !== 'string') return str;
    if (str.length === 1 && str === str.toUpperCase()) {
      return escapePythonKeyword(str);
    }
    // See toSnakeCase()'s matching comment (kept in sync with this
    // function's identical logic - toSnakeCase handles bare identifiers/
    // ThisPropertyAccess targets, this one handles dotted member/property
    // access, and a same all-caps name reaches both depending on which
    // shape of `this.X`/`obj.X` a given read happens to parse as, e.g.
    // speck.js's own `this.ROUNDS = 27` (ThisPropertyAccess, toSnakeCase)
    // vs `this.algorithm.ROUNDS` (MemberExpression, this function) both
    // needing to resolve to the identical Python attribute name): preserve
    // every all-uppercase name (single-word constants and
    // SCREAMING_SNAKE_CASE alike) instead of lowercasing it away, or a
    // same-scope camelCase/lowercase property that happens to snake_case to
    // the identical string silently collides with/shadows it.
    if (str === str.toUpperCase()) {
      return escapePythonKeyword(str);
    }

    const result = str
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .replace(/([a-z\d])([A-Z])/g, '$1_$2')
      .toLowerCase();

    return escapePythonKeyword(result);
  }

  /**
   * Keep PascalCase for class names
   */
  function toPascalCase(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * JavaScript AST to Python AST Transformer
   */
  class PythonTransformer {
    constructor(options = {}) {
      this.options = options;
      this.typeKnowledge = options.typeKnowledge || null;
      this.addTypeHints = options.addTypeHints !== undefined ? options.addTypeHints : true;
      this.addDocstrings = options.addDocstrings !== undefined ? options.addDocstrings : true;
      // strictTypes: when true, always add type hints even when 'Any' (never omit type annotations)
      // when false, only add type hints when we have concrete types (omit 'Any')
      this.strictTypes = options.strictTypes !== undefined ? options.strictTypes : false;
      this.currentClass = null;
      this.currentMethod = null;
      // Raw JS AST node (params + body) of the function/method currently
      // being transformed - see _isArrayLikeParam's doc comment for what
      // this backs. Separate from currentMethod, which holds the
      // already-transformed PYTHON function node.
      this._currentFunctionNode = null;
      // Function-node -> Set(paramName) memo cache for _isArrayLikeParam,
      // keyed by _currentFunctionNode identity (a fresh scan is cheap but
      // needless work to repeat for every `if` inside the same function).
      this._arrayLikeParamCache = new Map();
      this.currentClassMethodNames = null; // Set of method names in current class for collision detection
      this.currentMethodNameOverrides = null; // rawName -> disambiguated snake_case name, for methods that collide only after case-folding
      this._knownIntThisProps = new Set(); // raw `this.<name>` property names whose assigned value we know is integer-valued (see isFloatOperand's stale-float-tag workaround)
      this.currentPropertyName = null; // Track when we're inside a getter/setter and its name
      this.variableTypes = new Map();
      this.warnings = [];
      this.imports = new Set(); // Track needed imports
      this.scopeStack = [];

      // Track framework classes needed for stub generation
      this.frameworkClasses = new Set(); // Base classes used (BlockCipherAlgorithm, etc.)
      this.helperClasses = new Set();    // Helper classes (KeySize, LinkItem, etc.)
      this.enumsUsed = new Set();        // Enums referenced (category_type, etc.)
      this.frameworkFunctions = new Set(); // Framework functions (register_algorithm, etc.)

      // Track defined class names so we can preserve them in identifiers
      this.definedClassNames = new Set();

      // Renames for short, generic top-level constant-table names (K, H,
      // IV, SBOX, RCON, ...) that would otherwise collide across files when
      // several transpiled algorithms are concatenated into one flat Python
      // namespace - see the detailed comment in transformProgram() where
      // this is populated.
      this.moduleConstRenames = new Map();

      // Names (original JS spelling) of `const X = new Uint32Array(...)`
      // declarations - see transformTypedArrayCreation()'s `new
      // Uint8Array(X.buffer)` handling.
      this.uint32ArrayVarNames = new Set();

      // Names (original JS spelling) of `const/let X = a ^ b` (or `&`/`|`)
      // declarations whose value was never re-normalized to unsigned
      // afterward - see _lowerAsFloat64Chain's doc comment on why a raw
      // ^/&/| leaf needs JS-signed reinterpretation before entering a
      // float64 multiply chain. That correction only ever looked at the
      // IMMEDIATE AST node being lowered; when the raw bitwise op is
      // factored into its own statement first (e.g.
      // random/mersenne-twister.js's seeding loop: `const xored = prev ^
      // Shr32(prev, 30); const mult = ToUint32(INIT_MULTIPLIER *
      // xored);`), the multiply's operand is just a plain Identifier by
      // the time it's transformed - the fact that it holds an unnormalized
      // raw-bitwise value is invisible without this tracking, so the
      // reinterpretation silently never fires and the float chain
      // multiplies the wrong (always-non-negative) magnitude whenever the
      // true JS value would have been negative, corrupting every seed
      // derived this way.
      this._rawBitwiseVarNames = new Set();

      // Raw (pre-snake-case) JS names of local variables that this method's
      // body feeds, ANYWHERE later, as the sole argument to a transcendental
      // math function (Math.log2/log/log10/exp - see the 'Log2'/'Log'/
      // 'Log10'/'Exp' IL node cases and _collectTranscendentalArgNames) -
      // e.g. compression/bsc.js's `const p = freq / block.length; ... p *
      // Math.log2(p)`. Populated per-method by transformMethodDefinition
      // right before it transforms the method body, and consulted by
      // transformVariableDeclaration: a variable declared from a plain `/`
      // whose name appears here needs the TRUE floating-point quotient
      // (that's the entire point of taking its log) even though neither of
      // the division's own operands is individually float-tagged (see
      // isFloatOperand's doc comment for why an operand-only check misses
      // this - `freq` is an untyped loop variable and `block.length` is a
      // plain int, so the usual heuristics both assume this is the common
      // "int / int truncated toward an array index" idiom and truncate `p`
      // to 0 whenever freq < block.length, which is nearly always - then
      // `math.log2(0)` raises ValueError instead of computing the intended
      // fractional probability's entropy contribution).
      this._transcendentalArgNames = new Set();

      // Raw (pre-snake-case) JS names of local variables this method's body
      // compares against `undefined` ANYWHERE later (`x === undefined`/`x
      // !== undefined`, either operand order - see
      // _collectUndefinedCheckedNames) - e.g. classical/playfair.js's `let
      // char2 = normalizedInput[i + 1]; if (char2 === undefined) { ... }`
      // (odd-length input: the lookahead read runs off the end of the
      // string). Populated per-method by transformMethodDefinition;
      // consulted by transformVariableDeclaration to route a computed
      // member-access initializer through the `_js_idx` safe-subscript
      // helper (see its stub's doc comment) instead of a raw Python
      // subscript, which raises IndexError/KeyError instead of tolerating
      // an out-of-range read the way JS's bracket access silently does.
      this._undefinedCheckedVarNames = new Set();

      // Local variable names (snake_cased) known to alias the OpCodes object,
      // e.g. `const OC = typeof OpCodes !== 'undefined' ? OpCodes : global.OpCodes;`
      // Several algorithm files do this so OC.RotL32(...) etc. still needs to
      // route through the real OpCodes class, not a snake_cased method lookup.
      this.opCodesAliases = new Set();

      // Module-level (factory-body top-level) `let`/`const`/`var` names, snake_cased.
      // JavaScript closures freely reassign these; a Python function/def that
      // does the same needs an explicit `global x` line, or Python treats the
      // name as local-for-the-whole-function and raises UnboundLocalError on
      // the read that (in JS) happens before the write. See
      // transformFunctionDeclaration / _addGlobalDeclarationsIfNeeded.
      this.moduleLevelVarNames = new Set();

      // Stack of Sets, one per currently-open function scope (method,
      // top-level function, or hoisted nested function/closure), each
      // holding the snake_case names that scope has locally declared
      // (const/let/var) SO FAR while its body is being walked top-to-bottom.
      // Mirrors moduleLevelVarNames/_addGlobalDeclarationsIfNeeded's "global"
      // handling, but one level removed: a nested closure that mutates a
      // variable owned by an ENCLOSING FUNCTION (not the module) - e.g.
      // balloon.js's `_createHashFunctionWrapper() { let state = null;
      // return { init(){ state = x; }, digest(){ if (state) {...; state =
      // null; } } }; }`, where all three inner functions share one `state`
      // binding - needs `nonlocal state` in Python, not `global state`
      // (there's no module-level `state` at all) and not a bare local
      // (Python would silently shadow-and-discard the enclosing binding on
      // any local assignment, and additionally raises UnboundLocalError the
      // moment a function that both reads-then-assigns the same name, like
      // digest() above, is analyzed as all-local by Python's static
      // scoping). See _addNonlocalDeclarationsIfNeeded.
      this._enclosingLocalsStack = [];

      // Track pending post-statements (e.g., postfix increments that must be emitted after current statement)
      this.pendingPostStatements = [];
      // Track pending pre-statements (e.g., assignments in function args that must be emitted before current statement)
      this.pendingPreStatements = [];
      // Stack of variable names standing in for `this` while transforming a
      // hoisted object-literal-method function (see transformObjectExpression's
      // FunctionExpression-property handling) - such a function is emitted as
      // a bare module-level `def`, not a class method, so it has no `self`;
      // any `this.foo` inside it actually means "the containing object we're
      // a property of" (JS resolves `this` to the receiver at call time,
      // e.g. `NumberTheory.bar()` inside a method makes `this === NumberTheory`),
      // which is exactly the module-level variable the object literal gets
      // assigned to.
      this._objSelfNameStack = [];
      // One-shot handoff from transformVariableDeclaration's ObjectLiteral/
      // ObjectExpression branches to the object-literal handlers themselves -
      // see _currentSelfName()'s doc comment.
      this._pendingObjLiteralSelfName = null;
    }

    /**
     * The identifier `this` currently resolves to: the top of
     * _objSelfNameStack while hoisting a block-bodied object-literal-method
     * function (see transformObjectExpression / the 'ObjectLiteral' case),
     * otherwise the usual 'self' (a real class instance method).
     */
    _currentSelfName() {
      return this._objSelfNameStack.length > 0
        ? this._objSelfNameStack[this._objSelfNameStack.length - 1]
        : 'self';
    }

    /**
     * Get OpCodes return type from type knowledge
     */
    getOpCodesReturnType(methodName) {
      if (!this.typeKnowledge?.opCodesTypes) return null;
      const methodInfo = this.typeKnowledge.opCodesTypes[methodName];
      if (!methodInfo) return null;
      return this.mapTypeFromKnowledge(methodInfo.returns);
    }

    /**
     * Get Any type and track import
     */
    getAnyType() {
      this.imports.add('Any');
      return PythonType.Any();
    }

    /**
     * Map a type from type knowledge to PythonType
     */
    mapTypeFromKnowledge(typeName) {
      if (!typeName) return this.getAnyType();

      if (typeof typeName === 'string') {
        // Handle arrays
        if (typeName.endsWith('[]')) {
          const elementTypeName = typeName.slice(0, -2);
          const elementType = this.mapTypeFromKnowledge(elementTypeName);
          this.imports.add('List');
          return PythonType.List(elementType);
        }

        const mapped = TYPE_MAP[typeName] || typeName;
        return this.createPythonType(mapped);
      }

      return this.getAnyType();
    }

    /**
     * Infer type from expression
     */
    inferFullExpressionType(node) {
      if (!node) return this.getAnyType();

      switch (node.type) {
        case 'Literal':
          return this.inferLiteralType(node);
        case 'Identifier':
          const varType = this.getVariableType(node.name);
          return varType || PythonType.Int();
        case 'CallExpression':
          return this.inferCallExpressionType(node);
        case 'ArrayExpression':
        case 'ArrayLiteral':
          if (node.elements && node.elements.length > 0) {
            const elemType = this.inferFullExpressionType(node.elements[0]);
            this.imports.add('List');
            return PythonType.List(elemType);
          }
          this.imports.add('List');
          return PythonType.List(PythonType.Int());
        case 'BinaryExpression':
        case 'LogicalExpression':
          const compOps = ['==', '===', '!=', '!==', '<', '>', '<=', '>=', '&&', '||'];
          if (compOps.includes(node.operator)) {
            return PythonType.Bool();
          }
          // The shared parser (type-aware-transpiler.js) already resolved a
          // precise result type for this expression (e.g. `1.0 / IM` is
          // 'float64' because the literal's source text used decimal-point
          // notation, even though the *value* 1.0 looks integral). Defer to
          // it for float-shaped results instead of always assuming Int():
          // an unconditional Int() here caused module-level float constants
          // built from division (a common `const SCALE = 1.0 / N;` idiom)
          // to get an `: int` annotation, which downstream wrapped the
          // value in `int(...)`, truncating it to 0.
          if (node.resultType === 'float32' || node.resultType === 'float64' ||
              node.resultType === 'float' || node.resultType === 'double') {
            return PythonType.Float();
          }
          return PythonType.Int();
        default:
          return this.getAnyType();
      }
    }

    /**
     * Infer type from literal
     */
    inferLiteralType(node) {
      if (node.value === null) return PythonType.None();
      if (typeof node.value === 'boolean') return PythonType.Bool();
      if (typeof node.value === 'string') return PythonType.Str();
      if (typeof node.value === 'number') {
        return Number.isInteger(node.value) ? PythonType.Int() : PythonType.Float();
      }
      return this.getAnyType();
    }

    /**
     * Infer type from call expression
     */
    inferCallExpressionType(node) {
      if (node.callee.type === 'MemberExpression') {
        const obj = node.callee.object;
        const method = node.callee.property.name || node.callee.property.value;

        // Check OpCodes methods
        if (obj.type === 'Identifier' && obj.name === 'OpCodes') {
          const returnType = this.getOpCodesReturnType(method);
          if (returnType) return returnType;
        }
      }
      return this.getAnyType();
    }

    /**
     * Register variable type
     */
    registerVariableType(name, type) {
      this.variableTypes.set(name, type);
    }

    /**
     * Get variable type
     */
    getVariableType(name) {
      return this.variableTypes.get(name) || null;
    }

    /**
     * Push scope
     */
    pushScope() {
      this.scopeStack.push(new Map(this.variableTypes));
    }

    /**
     * Pop scope
     */
    popScope() {
      if (this.scopeStack.length > 0) {
        this.variableTypes = this.scopeStack.pop();
      }
    }

    /**
     * Transform JavaScript AST to Python AST
     */
    transform(ast) {
      const module = new PythonModule();

      // Whole-file heuristic used by transformUnaryExpression() for `~`:
      // uninitialized-then-reassigned locals (e.g. SHA-512/Skein's
      // `let a, b, c, d, e, f, g, h;` compression-loop registers) get no
      // useful resultType from the shared type-aware parser and fall back to
      // a default ('uint8') that is nonsense for these - they hold full
      // 64-bit round state. That default is indistinguishable, node-locally,
      // from a genuine byte value. A file that uses any BigInt literal
      // anywhere is, in this codebase, always a 64-bit/BigInt-state hash or
      // PRNG (never a mix of real byte-level `~` and BigInt state sharing
      // the same untyped-fallback bucket), so treat the ambiguous default as
      // 64-bit within such files - see isWideIntResultType() callers.
      this._fileHasBigIntLiterals = this._scanForBigIntLiterals(ast);

      // Process the AST
      if (ast.type === 'Program') {
        this.transformProgram(ast, module);
      } else {
        this.warnings.push('Expected Program node at root');
      }

      // Add collected imports at the beginning
      module.imports = this.collectImports();

      // Generate framework stub classes at the beginning of module
      const stubs = this.generateFrameworkStubs();
      if (stubs.length > 0) {
        module.statements = [...stubs, ...module.statements];
      }

      return module;
    }

    /**
     * Shallow, allocation-light scan for any BigInt literal (`5n`,
     * resultType 'bigint', etc.) anywhere in the AST. See the comment in
     * transform() for why this drives the `~` operator's mask heuristic.
     */
    _scanForBigIntLiterals(node, depth) {
      if (!node || typeof node !== 'object') return false;
      if (depth === undefined) depth = 0;
      if (depth > 200) return false; // guard against pathological/cyclic trees
      if (Array.isArray(node)) {
        for (const n of node) {
          if (this._scanForBigIntLiterals(n, depth + 1)) return true;
        }
        return false;
      }
      if (node.type === 'Literal' && typeof node.value === 'bigint') return true;
      if (node.resultType === 'bigint') return true;
      for (const k in node) {
        if (k === 'parent' || k === 'loc' || k === 'range') continue;
        const v = node[k];
        if (v && typeof v === 'object' && this._scanForBigIntLiterals(v, depth + 1)) return true;
      }
      return false;
    }

    /**
     * Generate stub classes for AlgorithmFramework classes used in inheritance
     */
    generateFrameworkStubs() {
      const stubs = [];

      // Framework base class stub definitions. Every algorithm/instance base
      // class in AlgorithmFramework.js needs a stub so transpiled code loads
      // regardless of which family it belongs to.
      const ALGORITHM_BASES = FRAMEWORK_ALGORITHM_BASES;
      const INSTANCE_BASES = FRAMEWORK_INSTANCE_BASES;
      const FRAMEWORK_STUBS = {};
      for (const name of ALGORITHM_BASES)
        FRAMEWORK_STUBS[name] = `class ${name}:\n    pass`;
      // *args/**kwargs (on every __init__ below) swallow extra positional
      // args - JS is forgiving of base-constructor call-site arity
      // mismatches (e.g. `super(algorithm, isInverse)` against a JS base
      // that only declares `constructor(algorithm)`); Python raises
      // TypeError on that unless the stub explicitly accepts (and ignores)
      // the extra arguments.
      //
      // Each subclass below also mirrors the extra instance fields its real
      // AlgorithmFramework.js counterpart initializes in its constructor
      // (IBlockCipherInstance.BlockSize/KeySize/key, IAeadInstance.aad/
      // tagSize, ...). Algorithm files routinely read these before ever
      // writing them (`if (this.aad && this.aad.length > 0)`, relying on
      // JS's forgiving `undefined`); Python raises AttributeError on a
      // truly-never-assigned instance attribute, so omitting the field here
      // turned that into a hard crash instead of the JS no-op.
      const INSTANCE_BASE_BODY = 'self.algorithm = algorithm\n        self.is_inverse = False\n        self.input_buffer = []';
      FRAMEWORK_STUBS['IAlgorithmInstance'] =
        `class IAlgorithmInstance:\n    def __init__(self, algorithm=None, *args, **kwargs):\n        ${INSTANCE_BASE_BODY}`;
      FRAMEWORK_STUBS['IBlockCipherInstance'] =
        `class IBlockCipherInstance:\n    def __init__(self, algorithm=None, *args, **kwargs):\n        ${INSTANCE_BASE_BODY}\n        self.block_size = 0\n        self.key_size = 0\n        self._key = None\n    @property\n    def key(self): return self._key\n    @key.setter\n    def key(self, value): self._key = value`;
      // The base default writes below (output_size/iterations) are wrapped in
      // try/except: JS keeps these distinct from a same-named-but-differently-
      // cased subclass accessor (e.g. IHashFunctionInstance's `this.OutputSize`
      // vs a subclass's `get/set outputSize()`) because JS property names are
      // case-sensitive. Python's snake_case folding collapses both to
      // `output_size`, so this base assignment resolves to the *subclass's*
      // property (Python looks up descriptors via the instance's actual
      // runtime class) and its setter's validation (e.g. "must be >= 1 byte")
      // rejects the harmless 0 default, crashing every instantiation. The
      // subclass constructor always re-initializes its own backing field
      // right after calling super().__init__(), so silently skipping a
      // rejected default here is safe - and a no-op for the (more common)
      // case where the subclass has no such property, where the plain
      // attribute assignment always succeeds.
      FRAMEWORK_STUBS['IHashFunctionInstance'] =
        `class IHashFunctionInstance:\n    def __init__(self, algorithm=None, *args, **kwargs):\n        ${INSTANCE_BASE_BODY}\n        try:\n            self.output_size = 0\n        except Exception:\n            pass`;
      FRAMEWORK_STUBS['IKdfInstance'] =
        `class IKdfInstance:\n    def __init__(self, algorithm=None, *args, **kwargs):\n        ${INSTANCE_BASE_BODY}\n        try:\n            self.output_size = 0\n        except Exception:\n            pass\n        try:\n            self.iterations = 0\n        except Exception:\n            pass`;
      FRAMEWORK_STUBS['IAeadInstance'] =
        `class IAeadInstance:\n    def __init__(self, algorithm=None, *args, **kwargs):\n        ${INSTANCE_BASE_BODY}\n        self.aad = []\n        self.tag_size = 0`;
      for (const name of INSTANCE_BASES) {
        if (FRAMEWORK_STUBS[name]) continue; // already given a tailored stub above
        FRAMEWORK_STUBS[name] = `class ${name}:\n    def __init__(self, algorithm=None, *args, **kwargs):\n        ${INSTANCE_BASE_BODY}`;
      }

      // Helper classes and enums.
      // These mirror the real AlgorithmFramework.js classes (see LinkItem/TestCase/
      // Vulnerability/AuthResult/KeySize there) but accept *args/**kwargs so that
      // call-site arity mismatches (JS is forgiving of extra/missing arguments;
      // several algorithm files pass description text as a 3rd LinkItem arg meant
      // for Vulnerability, or pass kwargs-only style) never raise TypeError.
      const HELPER_STUBS = {
        // Base class - must be defined before TestCase/Vulnerability (both extend it).
        'LinkItem': 'class LinkItem:\n    def __init__(self, text=None, uri=None, *args, **kwargs):\n        self.text = text\n        self.uri = uri\n        for _k, _v in kwargs.items(): setattr(self, _k, _v)',
        'TestCase': 'class TestCase(LinkItem):\n    def __init__(self, input=None, expected=None, description="", uri="", *args, **kwargs):\n        super().__init__(description, uri)\n        self.input = input\n        self.expected = expected\n        for _k, _v in kwargs.items(): setattr(self, _k, _v)',
        'Vulnerability': 'class Vulnerability(LinkItem):\n    def __init__(self, type=None, mitigation=None, uri="", *args, **kwargs):\n        super().__init__(type, uri)\n        self.type = type\n        self.mitigation = mitigation\n        for _k, _v in kwargs.items(): setattr(self, _k, _v)',
        'KeySize': 'class KeySize:\n    def __init__(self, min_size=0, max_size=0, step_size=1, *args, **kwargs):\n        self.min_size, self.max_size, self.step_size = min_size, max_size, step_size',
        'AuthResult': 'class AuthResult:\n    def __init__(self, success=None, output=None, failure_reason=None, *args, **kwargs):\n        self.success = success\n        self.output = output\n        self.failure_reason = failure_reason',
        // No __len__ here deliberately: _js_len() (see transformArrayLength)
        // relies on len(jsObject) *raising* TypeError so it can fall back to
        // reading the object's own "length" attribute (e.g. a match-finder
        // returning {length, distance} as a JSObject) - if JSObject defined
        // __len__ itself (say, "number of properties"), that fallback would
        // never trigger and every `.length` read would silently become a
        // property count instead of the actual intended value.
        // __bool__ always True: a JS object is truthy even when empty ({} is
        // truthy in JS); without this, an empty-but-present {} state object
        // used only in `if (this.someObjectState)` guards would otherwise
        // fall back to Python's default object truthiness, which - luckily
        // for a plain object with no __len__/__bool__ - is already always
        // True, but this makes the JS-parity intentional and explicit.
        // _k() mirrors JS's ToPropertyKey coercion for bracket access: JS
        // object keys are always strings, so `obj[256]` and `obj["256"]`
        // address the same property (the number is stringified). Object
        // literals with numeric-looking keys (e.g. `{256: 22, 512: 30}`,
        // a common size-lookup-table idiom) are emitted with quoted string
        // keys, so a plain int/float subscript must be coerced the same way
        // on every access path or the lookup silently misses.
        // .set/.delete/.entries/.size mirror the subset of JS Map's API that
        // shows up in practice when a `new Map()` (or a class field
        // initialized from one) isn't IL-tagged as a dedicated Map/dict
        // creation and falls through to being emitted as a generic JSObject
        // instead - without these, calls like `this.timers.delete(name)` or
        // `this.counters.size` raise AttributeError since a plain object
        // literal has no reason to support them otherwise.
        // _JSAccessor is a per-instance getter/setter descriptor sentinel:
        // legacy `const X = { get key(){...}, set key(v){...} }` algorithm
        // objects (deal.js, lucifer.js, mars.js, pike.js, xchacha20.js -
        // see transformObjectExpression's accessor-pair handling) store one
        // of these under the property key instead of a plain value. Ordinary
        // Python @property only works as a *class*-level descriptor; these
        // objects are plain per-instance dicts (one JSObject per algorithm
        // instance, no shared class), so JSObject itself has to recognize
        // the sentinel in __getattribute__/__setattr__/__getitem__/
        // __setitem__ and dispatch to fget()/fset(v) instead of returning/
        // overwriting it - otherwise `instance.key = bytes` silently becomes
        // a plain attribute overwrite and the setter (e.g. one that calls
        // KeySetup) never runs.
        'JSObject': 'class _JSAccessor:\n    def __init__(self, fget=None, fset=None):\n        self.fget = fget\n        self.fset = fset\nclass JSObject:\n    def __init__(self, d=None):\n        if d: self.__dict__.update(d)\n    @staticmethod\n    def _k(k): return str(int(k)) if isinstance(k, int) and not isinstance(k, bool) else (str(k) if isinstance(k, float) else k)\n    def __getattribute__(self, name):\n        v = object.__getattribute__(self, name)\n        if isinstance(v, _JSAccessor):\n            return v.fget() if v.fget is not None else None\n        return v\n    def __getattr__(self, name):\n        raise AttributeError(name)\n    def __setattr__(self, name, value):\n        d = object.__getattribute__(self, "__dict__")\n        cur = d.get(name)\n        if isinstance(cur, _JSAccessor):\n            if cur.fset is not None: cur.fset(value)\n            return\n        d[name] = value\n    def __getitem__(self, k):\n        v = self.__dict__.get(JSObject._k(k))\n        return v.fget() if isinstance(v, _JSAccessor) and v.fget is not None else (None if isinstance(v, _JSAccessor) else v)\n    def __setitem__(self, k, v):\n        kk = JSObject._k(k)\n        cur = self.__dict__.get(kk)\n        if isinstance(cur, _JSAccessor):\n            if cur.fset is not None: cur.fset(v)\n            return\n        self.__dict__[kk] = v\n    def __delitem__(self, k): self.__dict__.pop(JSObject._k(k), None)\n    def __contains__(self, k): return JSObject._k(k) in self.__dict__\n    def __bool__(self): return True\n    def get(self, k, default=None):\n        v = self.__dict__.get(JSObject._k(k), default)\n        return v.fget() if isinstance(v, _JSAccessor) and v.fget is not None else (None if isinstance(v, _JSAccessor) else v)\n    def set(self, k, v):\n        self[k] = v\n        return self\n    def delete(self, k):\n        return self.__dict__.pop(JSObject._k(k), None) is not None\n    def keys(self): return self.__dict__.keys()\n    def values(self): return self.__dict__.values()\n    def items(self): return self.__dict__.items()\n    def entries(self): return list(self.__dict__.items())\n    def clear(self): self.__dict__.clear()\n    def has_own_property(self, k): return JSObject._k(k) in self.__dict__\n    @property\n    def size(self): return len(self.__dict__)',
        // Internal bit-level I/O helper backing OpCodes.CreateBitStream() -
        // direct port of OpCodes.js's _BitStream (see CreateBitStream/_BitStream there).
        'BitStream': `class _BitStream:
    def __init__(self, initial_bytes=None):
        self.buffer = 0
        self.buffer_bits = 0
        self.byte_array = []
        self.read_position = 0
        self.total_bits_written = 0
        if initial_bytes and len(initial_bytes) > 0:
            self.byte_array = list(initial_bytes)
            self.total_bits_written = len(initial_bytes) * 8

    def writeBits(self, value, num_bits):
        if num_bits <= 0 or num_bits > 32:
            raise Exception('BitStream.writeBits: numBits must be 1-32')
        mask = 0xFFFFFFFF if num_bits == 32 else (1 << num_bits) - 1
        value = (value & 0xFFFFFFFF) & mask
        self.buffer = (self.buffer << num_bits) | value
        self.buffer_bits += num_bits
        self.total_bits_written += num_bits
        while self.buffer_bits >= 8:
            self.buffer_bits -= 8
            byte = (self.buffer >> self.buffer_bits) & 0xFF
            self.byte_array.append(byte)
            if self.buffer_bits > 0:
                remaining_mask = (1 << self.buffer_bits) - 1
                self.buffer &= remaining_mask
            else:
                self.buffer = 0

    def writeBit(self, bit):
        self.writeBits(bit & 1, 1)

    def writeByte(self, byte):
        self.writeBits(byte & 0xFF, 8)

    def writeBytes(self, byte_list):
        for b in byte_list:
            self.writeByte(b)

    def writeUint16BE(self, value):
        self.writeBits((value >> 8) & 0xFF, 8)
        self.writeBits(value & 0xFF, 8)

    def writeUint16LE(self, value):
        self.writeBits(value & 0xFF, 8)
        self.writeBits((value >> 8) & 0xFF, 8)

    def writeUint32BE(self, value):
        value &= 0xFFFFFFFF
        self.writeBits((value >> 24) & 0xFF, 8)
        self.writeBits((value >> 16) & 0xFF, 8)
        self.writeBits((value >> 8) & 0xFF, 8)
        self.writeBits(value & 0xFF, 8)

    def writeUint32LE(self, value):
        value &= 0xFFFFFFFF
        self.writeBits(value & 0xFF, 8)
        self.writeBits((value >> 8) & 0xFF, 8)
        self.writeBits((value >> 16) & 0xFF, 8)
        self.writeBits((value >> 24) & 0xFF, 8)

    def readBits(self, num_bits):
        if num_bits <= 0 or num_bits > 32:
            raise Exception('BitStream.readBits: numBits must be 1-32')
        result = 0
        bits_read = 0
        while bits_read < num_bits:
            byte_index = self.read_position // 8
            bit_offset = self.read_position % 8
            if byte_index >= len(self.byte_array):
                if bits_read == 0:
                    raise Exception('BitStream.readBits: No more data available')
                break
            current_byte = self.byte_array[byte_index]
            available_bits = 8 - bit_offset
            bits_to_read = min(num_bits - bits_read, available_bits)
            mask = (1 << bits_to_read) - 1
            extracted_bits = (current_byte >> (available_bits - bits_to_read)) & mask
            result = (result << bits_to_read) | extracted_bits
            bits_read += bits_to_read
            self.read_position += bits_to_read
        return result

    def readBit(self):
        return self.readBits(1)

    def readByte(self):
        return self.readBits(8) & 0xFF

    def readBytes(self, count):
        return [self.readByte() for _ in range(count)]

    def peekBits(self, num_bits):
        saved = self.read_position
        result = self.readBits(num_bits)
        self.read_position = saved
        return result

    def skipBits(self, num_bits):
        self.read_position += num_bits
        max_position = len(self.byte_array) * 8
        if self.read_position > max_position:
            self.read_position = max_position

    def hasMoreBits(self):
        return self.read_position < len(self.byte_array) * 8

    def getRemainingBits(self):
        return max(0, len(self.byte_array) * 8 - self.read_position)

    def resetReadPosition(self):
        self.read_position = 0

    def seekBits(self, bit_offset):
        max_bits = len(self.byte_array) * 8
        offset = bit_offset & 0x7FFFFFFF
        clamped = max_bits if offset > max_bits else offset
        self.read_position = clamped if clamped > 0 else 0

    def toArray(self, pad_last_byte=True):
        if self.buffer_bits > 0 and pad_last_byte:
            padding_bits = 8 - self.buffer_bits
            self.buffer = self.buffer << padding_bits
            self.byte_array.append(self.buffer & 0xFF)
            self.buffer = 0
            self.buffer_bits = 0
        return list(self.byte_array)

    def getBitLength(self):
        return self.total_bits_written

    def getByteLength(self):
        complete_bytes_in_buffer = self.buffer_bits // 8
        has_partial_byte = 1 if (self.buffer_bits % 8) > 0 else 0
        return len(self.byte_array) + complete_bytes_in_buffer + has_partial_byte

    def clear(self):
        self.buffer = 0
        self.buffer_bits = 0
        self.byte_array = []
        self.read_position = 0
        self.total_bits_written = 0

    def clone(self):
        cloned = _BitStream()
        cloned.buffer = self.buffer
        cloned.buffer_bits = self.buffer_bits
        cloned.byte_array = list(self.byte_array)
        cloned.read_position = self.read_position
        cloned.total_bits_written = self.total_bits_written
        return cloned

    def writeVarInt(self, value):
        value &= 0xFFFFFFFF
        while value >= 0x80:
            self.writeByte((value & 0x7F) | 0x80)
            value >>= 7
        self.writeByte(value & 0x7F)

    def readVarInt(self):
        result = 0
        shift = 0
        while True:
            if shift >= 32:
                raise Exception('BitStream.readVarInt: Integer overflow')
            byte = self.readByte()
            result |= (byte & 0x7F) << shift
            shift += 7
            if not (byte & 0x80):
                break
        return result & 0xFFFFFFFF

    def writeUnary(self, value):
        for _ in range(value):
            self.writeBit(1)
        self.writeBit(0)

    def readUnary(self):
        count = 0
        while self.hasMoreBits() and self.readBit() == 1:
            count += 1
        return count

    def alignToByte(self):
        while self.buffer_bits % 8 != 0:
            self.writeBit(0)

    def isAligned(self):
        return self.buffer_bits % 8 == 0
_BitStream.write_bits = _BitStream.writeBits
_BitStream.write_bit = _BitStream.writeBit
_BitStream.write_byte = _BitStream.writeByte
_BitStream.write_bytes = _BitStream.writeBytes
_BitStream.write_uint16_be = _BitStream.writeUint16BE
_BitStream.write_uint16_le = _BitStream.writeUint16LE
_BitStream.write_uint32_be = _BitStream.writeUint32BE
_BitStream.write_uint32_le = _BitStream.writeUint32LE
_BitStream.read_bits = _BitStream.readBits
_BitStream.read_bit = _BitStream.readBit
_BitStream.read_byte = _BitStream.readByte
_BitStream.read_bytes = _BitStream.readBytes
_BitStream.peek_bits = _BitStream.peekBits
_BitStream.skip_bits = _BitStream.skipBits
_BitStream.has_more_bits = _BitStream.hasMoreBits
_BitStream.get_remaining_bits = _BitStream.getRemainingBits
_BitStream.reset_read_position = _BitStream.resetReadPosition
_BitStream.seek_bits = _BitStream.seekBits
_BitStream.to_array = _BitStream.toArray
_BitStream.get_bit_length = _BitStream.getBitLength
_BitStream.get_byte_length = _BitStream.getByteLength
_BitStream.write_var_int = _BitStream.writeVarInt
_BitStream.read_var_int = _BitStream.readVarInt
_BitStream.write_unary = _BitStream.writeUnary
_BitStream.read_unary = _BitStream.readUnary
_BitStream.align_to_byte = _BitStream.alignToByte
_BitStream.is_aligned = _BitStream.isAligned`,
        // Comprehensive Python port of OpCodes.js. Every OpCodes.* call in
        // transpiled code (see transformOpCodesCall / the 'OpCodesCall' IL
        // case) routes to a method here by the same PascalCase name used in
        // JavaScript, so no algorithm-specific mapping table is needed and
        // no OpCodes method can resolve to an undefined bare function call.
        'OpCodes': `class _OpCodesMeta(type):
    # A handful of algorithm files reference a bare OpCodes.<NAME> constant
    # that was never actually added to the real OpCodes.js (e.g.
    # special/3way.js's \`global.OpCodes.MASK32\`, which doesn't exist
    # anywhere in OpCodes.js). In JS, reading a missing property never
    # throws - it's just \`undefined\`, which the surrounding bitwise
    # AND/OR/XOR then silently coerces to 0 per ToInt32(undefined) === 0
    # (matching OpCodes.AndN/OrN/XorN's plain \`a & b\`/\`a | b\`/\`a ^ b\`
    # bodies) - so the algorithm still runs, just always combining with 0
    # there. A plain Python \`class OpCodes:\` has no such fallback: reading
    # a name that isn't one of the @staticmethods below raises
    # AttributeError immediately, aborting the whole computation instead of
    # reproducing that harmless-in-JS "undefined constant" quirk. This
    # metaclass intercepts attribute lookups that fail against the class
    # itself (OpCodes is used as a static namespace, never instantiated, so
    # a metaclass - not a normal instance \`__getattr__\` - is what's needed
    # to catch \`OpCodes.<missing>\`) and returns 0, mirroring JS's coercion
    # instead of crashing. This only ever fires for names the class doesn't
    # define - every real OpCodes.* method below resolves normally first.
    def __getattr__(cls, name):
        return 0
class OpCodes(metaclass=_OpCodesMeta):
    # ==================[ BIT MANIPULATION ]==================
    @staticmethod
    def RotL8(value, positions):
        value &= 0xFF
        positions &= 7
        return ((value << positions) | (value >> (8 - positions))) & 0xFF if positions else value

    @staticmethod
    def RotR8(value, positions):
        value &= 0xFF
        positions &= 7
        return ((value >> positions) | (value << (8 - positions))) & 0xFF if positions else value

    @staticmethod
    def RotL16(value, positions):
        value &= 0xFFFF
        positions &= 15
        return ((value << positions) | (value >> (16 - positions))) & 0xFFFF if positions else value

    @staticmethod
    def RotR16(value, positions):
        value &= 0xFFFF
        positions &= 15
        return ((value >> positions) | (value << (16 - positions))) & 0xFFFF if positions else value

    @staticmethod
    def RotL32(value, positions):
        value &= 0xFFFFFFFF
        positions &= 31
        return ((value << positions) | (value >> (32 - positions))) & 0xFFFFFFFF if positions else value

    @staticmethod
    def RotR32(value, positions):
        value &= 0xFFFFFFFF
        positions &= 31
        return ((value >> positions) | (value << (32 - positions))) & 0xFFFFFFFF if positions else value

    @staticmethod
    def Shl8(value, positions):
        return (value << positions) & 0xFF

    @staticmethod
    def Shr8(value, positions):
        return ((value & 0xFFFFFFFF) >> positions) & 0xFF

    @staticmethod
    def Shl16(value, positions):
        return (value << positions) & 0xFFFF

    @staticmethod
    def Shr16(value, positions):
        return ((value & 0xFFFFFFFF) >> positions) & 0xFFFF

    @staticmethod
    def Shl32(value, positions):
        return (value << positions) & 0xFFFFFFFF

    @staticmethod
    def Shr32(value, positions):
        return ((value & 0xFFFFFFFF) >> positions) & 0xFFFFFFFF

    @staticmethod
    def Shr32Signed(value, positions):
        value &= 0xFFFFFFFF
        if value >= 0x80000000:
            value -= 0x100000000
        return (value >> positions) & 0xFFFFFFFF

    # ==================[ BITWISE LOGICAL (8/16-bit) ]==================
    @staticmethod
    def And8(a, b):
        return (a & b) & 0xFF

    @staticmethod
    def Or8(a, b):
        return (a | b) & 0xFF

    @staticmethod
    def Xor8(a, b):
        return (a ^ b) & 0xFF

    @staticmethod
    def Not8(a):
        return (~a) & 0xFF

    @staticmethod
    def And16(a, b):
        return (a & b) & 0xFFFF

    @staticmethod
    def Or16(a, b):
        return (a | b) & 0xFFFF

    @staticmethod
    def Xor16(a, b):
        return (a ^ b) & 0xFFFF

    @staticmethod
    def Not16(a):
        return (~a) & 0xFFFF

    # ==================[ BIGINT-STYLE ROTATE/SHIFT (plain ints in Python) ]==================
    @staticmethod
    def RotL64n(value, positions):
        mask64 = 0xFFFFFFFFFFFFFFFF
        value &= mask64
        positions &= 63
        if positions == 0:
            return value
        return ((value << positions) | (value >> (64 - positions))) & mask64

    @staticmethod
    def RotR64n(value, positions):
        mask64 = 0xFFFFFFFFFFFFFFFF
        value &= mask64
        positions &= 63
        if positions == 0:
            return value
        return ((value >> positions) | (value << (64 - positions))) & mask64

    @staticmethod
    def ShiftLn(value, positions):
        return value << positions

    @staticmethod
    def ShiftRn(value, positions):
        return value >> positions

    # ==================[ TYPE CONVERSIONS ]==================
    @staticmethod
    def ToByte(value):
        return value & 0xFF

    @staticmethod
    def UintToByte(value):
        return value & 0xFF

    @staticmethod
    def ToSByte(value):
        value &= 0xFF
        return value - 256 if value > 127 else value

    @staticmethod
    def ToWord(value):
        return value & 0xFFFF

    @staticmethod
    def ToShort(value):
        value &= 0xFFFF
        return value - 65536 if value > 32767 else value

    @staticmethod
    def ToDWord(value):
        return value & 0xFFFFFFFF

    @staticmethod
    def ToInt(value):
        value &= 0xFFFFFFFF
        return value - 0x100000000 if value >= 0x80000000 else value

    @staticmethod
    def ToQWord(value):
        return value & 0xFFFFFFFFFFFFFFFF

    @staticmethod
    def ToLong(value):
        value &= 0xFFFFFFFFFFFFFFFF
        return value - 0x10000000000000000 if value > 0x7FFFFFFFFFFFFFFF else value

    @staticmethod
    def ToUint32(value):
        return value & 0xFFFFFFFF

    @staticmethod
    def ToUint16(value):
        return value & 0xFFFF

    @staticmethod
    def ToUint8(value):
        return value & 0xFF

    # ==================[ 64-BIT (low,high) PAIR ROTATION ]==================
    @staticmethod
    def RotL64(low, high, positions):
        low &= 0xFFFFFFFF
        high &= 0xFFFFFFFF
        positions &= 63
        if positions == 0:
            return JSObject({"low": low, "high": high})
        if positions < 32:
            new_high = ((high << positions) | (low >> (32 - positions))) & 0xFFFFFFFF
            new_low = ((low << positions) | (high >> (32 - positions))) & 0xFFFFFFFF
            return JSObject({"low": new_low, "high": new_high})
        positions -= 32
        if positions == 0:
            return JSObject({"low": high, "high": low})
        new_high = ((low << positions) | (high >> (32 - positions))) & 0xFFFFFFFF
        new_low = ((high << positions) | (low >> (32 - positions))) & 0xFFFFFFFF
        return JSObject({"low": new_low, "high": new_high})

    @staticmethod
    def RotR64(low, high, positions):
        low &= 0xFFFFFFFF
        high &= 0xFFFFFFFF
        positions &= 63
        if positions == 0:
            return JSObject({"low": low, "high": high})
        if positions < 32:
            new_low = ((low >> positions) | (high << (32 - positions))) & 0xFFFFFFFF
            new_high = ((high >> positions) | (low << (32 - positions))) & 0xFFFFFFFF
            return JSObject({"low": new_low, "high": new_high})
        positions -= 32
        if positions == 0:
            return JSObject({"low": high, "high": low})
        new_low = ((high >> positions) | (low << (32 - positions))) & 0xFFFFFFFF
        new_high = ((low >> positions) | (high << (32 - positions))) & 0xFFFFFFFF
        return JSObject({"low": new_low, "high": new_high})

    # ==================[ 128-BIT ROTATION ]==================
    @staticmethod
    def RotL128n(value, positions):
        mask128 = (1 << 128) - 1
        value &= mask128
        positions &= 127
        if positions == 0:
            return value
        return ((value << positions) | (value >> (128 - positions))) & mask128

    @staticmethod
    def RotR128n(value, positions):
        mask128 = (1 << 128) - 1
        value &= mask128
        positions &= 127
        if positions == 0:
            return value
        return ((value >> positions) | (value << (128 - positions))) & mask128

    @staticmethod
    def RotL128(byte_list, positions):
        if positions == 0 or len(byte_list) != 16:
            return list(byte_list)
        positions = positions % 128
        if positions == 0:
            return list(byte_list)
        result = [0] * 16
        byte_shift = positions // 8
        bit_shift = positions % 8
        for i in range(16):
            source_idx = (i + byte_shift) % 16
            value = byte_list[source_idx]
            if bit_shift > 0:
                next_idx = (source_idx + 1) % 16
                value = ((value << bit_shift) | (byte_list[next_idx] >> (8 - bit_shift))) & 0xFF
            result[i] = value
        return result

    @staticmethod
    def RotR128(byte_list, positions):
        if positions == 0 or len(byte_list) != 16:
            return list(byte_list)
        positions = positions % 128
        return OpCodes.RotL128(byte_list, 128 - positions)

    # ==================[ BYTE/WORD OPERATIONS ]==================
    @staticmethod
    def Pack16BE(b0, b1):
        return ((b0 & 0xFF) << 8) | (b1 & 0xFF)

    @staticmethod
    def Unpack16BE(word):
        word &= 0xFFFF
        return [(word >> 8) & 0xFF, word & 0xFF]

    @staticmethod
    def Pack16LE(b0, b1):
        return ((b1 & 0xFF) << 8) | (b0 & 0xFF)

    @staticmethod
    def Unpack16LE(word):
        word &= 0xFFFF
        return [word & 0xFF, (word >> 8) & 0xFF]

    @staticmethod
    def Pack32BE(b0, b1, b2, b3):
        return (((b0 & 0xFF) << 24) | ((b1 & 0xFF) << 16) | ((b2 & 0xFF) << 8) | (b3 & 0xFF)) & 0xFFFFFFFF

    @staticmethod
    def Unpack32BE(word):
        word &= 0xFFFFFFFF
        return [(word >> 24) & 0xFF, (word >> 16) & 0xFF, (word >> 8) & 0xFF, word & 0xFF]

    @staticmethod
    def Pack32LE(b0, b1, b2, b3):
        return (((b3 & 0xFF) << 24) | ((b2 & 0xFF) << 16) | ((b1 & 0xFF) << 8) | (b0 & 0xFF)) & 0xFFFFFFFF

    @staticmethod
    def Unpack32LE(word):
        word &= 0xFFFFFFFF
        return [word & 0xFF, (word >> 8) & 0xFF, (word >> 16) & 0xFF, (word >> 24) & 0xFF]

    @staticmethod
    def Pack64BE(b0, b1, b2, b3, b4, b5, b6, b7):
        return (((b0 & 0xFF) << 56) | ((b1 & 0xFF) << 48) | ((b2 & 0xFF) << 40) | ((b3 & 0xFF) << 32) |
                ((b4 & 0xFF) << 24) | ((b5 & 0xFF) << 16) | ((b6 & 0xFF) << 8) | (b7 & 0xFF))

    @staticmethod
    def Unpack64BE(qword):
        qword &= 0xFFFFFFFFFFFFFFFF
        return [(qword >> 56) & 0xFF, (qword >> 48) & 0xFF, (qword >> 40) & 0xFF, (qword >> 32) & 0xFF,
                (qword >> 24) & 0xFF, (qword >> 16) & 0xFF, (qword >> 8) & 0xFF, qword & 0xFF]

    @staticmethod
    def Pack64LE(b0, b1, b2, b3, b4, b5, b6, b7):
        return (((b7 & 0xFF) << 56) | ((b6 & 0xFF) << 48) | ((b5 & 0xFF) << 40) | ((b4 & 0xFF) << 32) |
                ((b3 & 0xFF) << 24) | ((b2 & 0xFF) << 16) | ((b1 & 0xFF) << 8) | (b0 & 0xFF))

    @staticmethod
    def Unpack64LE(qword):
        qword &= 0xFFFFFFFFFFFFFFFF
        return [qword & 0xFF, (qword >> 8) & 0xFF, (qword >> 16) & 0xFF, (qword >> 24) & 0xFF,
                (qword >> 32) & 0xFF, (qword >> 40) & 0xFF, (qword >> 48) & 0xFF, (qword >> 56) & 0xFF]

    @staticmethod
    def Words32ToBytesBE(words):
        result = []
        for w in words:
            w &= 0xFFFFFFFF
            result.append((w >> 24) & 0xFF)
            result.append((w >> 16) & 0xFF)
            result.append((w >> 8) & 0xFF)
            result.append(w & 0xFF)
        return result

    @staticmethod
    def BytesToWords32BE(byte_list):
        words = []
        n = len(byte_list)
        for i in range(0, n, 4):
            b0 = byte_list[i] & 0xFF if i < n else 0
            b1 = byte_list[i + 1] & 0xFF if i + 1 < n else 0
            b2 = byte_list[i + 2] & 0xFF if i + 2 < n else 0
            b3 = byte_list[i + 3] & 0xFF if i + 3 < n else 0
            words.append(OpCodes.Pack32BE(b0, b1, b2, b3))
        return words

    @staticmethod
    def GetByte(word, byte_index):
        return (word >> (byte_index * 8)) & 0xFF

    # ==================[ HEX UTILITIES ]==================
    @staticmethod
    def HexCharCodeToValue(code):
        if 48 <= code <= 57:
            return (code - 48) & 0xFF
        if 65 <= code <= 70:
            return (code - 55) & 0xFF
        if 97 <= code <= 102:
            return (code - 87) & 0xFF
        return 0

    @staticmethod
    def Hex4ToBytes(hex_string):
        return [OpCodes.HexCharCodeToValue(ord(c)) for c in hex_string]

    @staticmethod
    def Hex8ToBytes(hex_string):
        return list(bytes.fromhex(hex_string))

    @staticmethod
    def Hex16ToWords(hex_string):
        return [int(hex_string[i:i + 4], 16) for i in range(0, len(hex_string), 4)]

    @staticmethod
    def Hex32ToDWords(hex_string):
        return [int(hex_string[i:i + 8], 16) & 0xFFFFFFFF for i in range(0, len(hex_string), 8)]

    # ==================[ STRING/BYTE CONVERSIONS ]==================
    @staticmethod
    def AnsiToBytes(s):
        return [ord(c) & 0x7F for c in s]

    @staticmethod
    def BytesToAnsi(byte_list):
        return ''.join(chr(b & 0x7F) for b in byte_list)

    @staticmethod
    def AsciiToBytes(s):
        return [ord(c) & 0xFF for c in s]

    @staticmethod
    def DoubleToBytes(value):
        # Mirrors OpCodes.js's own DoubleToBytes exactly: a documented
        # placeholder ("This placeholder returns zero bytes - implement
        # properly at platform level") that always returns 8 zero bytes
        # rather than a real IEEE 754 encoding - the ONLY algorithm in this
        # codebase calling it (random/dsfmt.js) computes both its actual
        # output AND its hardcoded test vectors through this same call, so
        # faithfully reproducing the placeholder (not "fixing" it into a
        # real struct.pack) is what keeps the two sides comparable, exactly
        # as real JS behaves.
        return [0, 0, 0, 0, 0, 0, 0, 0]

    @staticmethod
    def BytesToDouble(byte_list):
        # Mirrors OpCodes.js's own BytesToDouble placeholder (always 0.0) -
        # see DoubleToBytes above for why staying bug-compatible here matters.
        if len(byte_list) < 8:
            raise Exception('BytesToDouble: Need at least 8 bytes')
        return 0.0

    # ==================[ ARRAY OPERATIONS ]==================
    @staticmethod
    def XorArrays(arr1, arr2):
        n = min(len(arr1), len(arr2))
        return [(arr1[i] ^ arr2[i]) & 0xFF for i in range(n)]

    @staticmethod
    def CopyArray(arr):
        return list(arr)

    @staticmethod
    def ClearArray(arr):
        for i in range(len(arr)):
            arr[i] = 0

    @staticmethod
    def CopyBytes(src, src_offset, dst, dst_offset, length):
        for i in range(length):
            dst[dst_offset + i] = src[src_offset + i]

    @staticmethod
    def CompareArrays(arr1, arr2):
        return list(arr1) == list(arr2)

    @staticmethod
    def SecureCompare(arr1, arr2):
        if len(arr1) != len(arr2):
            return False
        result = 0
        for i in range(len(arr1)):
            result |= arr1[i] ^ arr2[i]
        return result == 0

    @staticmethod
    def ConstantTimeCompare(arr1, arr2, length=None):
        if length is None:
            length = min(len(arr1), len(arr2))
        result = 0
        for i in range(length):
            v1 = arr1[i] if i < len(arr1) else 0
            v2 = arr2[i] if i < len(arr2) else 0
            result |= v1 ^ v2
        result |= len(arr1) ^ len(arr2)
        return result == 0

    @staticmethod
    def ArraysEqual(arr1, arr2):
        if len(arr1) != len(arr2):
            return False
        result = 0
        for i in range(len(arr1)):
            result |= arr1[i] ^ arr2[i]
        return result == 0

    @staticmethod
    def CreateArray(length, value=0):
        return [value] * length

    @staticmethod
    def ArraySlice(arr, start, end=None):
        if end is None:
            end = len(arr)
        return [arr[i] for i in range(start, min(end, len(arr)))]

    @staticmethod
    def ConcatArrays(*arrays):
        # JS ConcatArrays(arrays) takes a single array-of-arrays; also accept
        # a single list argument for that call shape.
        if len(arrays) == 1 and arrays[0] and isinstance(arrays[0][0], (list, tuple, bytes, bytearray)):
            arrays = arrays[0]
        result = []
        for a in arrays:
            result.extend(a)
        return result

    @staticmethod
    def InverseSBoxLookup(sbox, output):
        for i in range(256):
            if sbox[i] == output:
                return i & 0xFF
        return 0

    @staticmethod
    def BuildInverseSBox(sbox):
        inverse = [0] * 256
        for i in range(256):
            inverse[sbox[i]] = i
        return inverse

    @staticmethod
    def SplitNibbles(byte_val):
        return JSObject({"high": (byte_val >> 4) & 0x0F, "low": byte_val & 0x0F})

    @staticmethod
    def CombineNibbles(high, low):
        return ((high & 0x0F) << 4) | (low & 0x0F)

    @staticmethod
    def SafeArrayAccess(array, index, default_value=0):
        if 0 <= index < len(array):
            return array[index]
        return default_value

    @staticmethod
    def CircularArrayAccess(array, index):
        if len(array) == 0:
            return None
        index = ((index % len(array)) + len(array)) % len(array)
        return array[index]

    @staticmethod
    def XorArrayWithByte(array, value):
        value &= 0xFF
        return [(b ^ value) & 0xFF for b in array]

    # ==================[ MATH / GF ARITHMETIC ]==================
    @staticmethod
    def AddMod(a, b, m):
        return ((a % m) + (b % m)) % m

    @staticmethod
    def SubMod(a, b, m):
        return ((a % m) - (b % m) + m) % m

    @staticmethod
    def MulMod(a, b, m):
        return ((a % m) * (b % m)) % m

    @staticmethod
    def ModSafe(value, modulus):
        result = value % modulus
        return result + modulus if result < 0 else result

    @staticmethod
    def GF256Mul(a, b):
        result = 0
        a &= 0xFF
        b &= 0xFF
        for _ in range(8):
            if b & 1:
                result ^= a
            high_bit = a & 0x80
            a = (a << 1) & 0xFF
            if high_bit:
                a ^= 0x1B
            b >>= 1
        return result & 0xFF

    @staticmethod
    def GF2PolyMul(a, b):
        result = 0
        while b:
            if b & 1:
                result ^= a
            a <<= 1
            b >>= 1
        return result & 0xFFFFFFFF

    @staticmethod
    def GFMul(a, b, irreducible, width):
        result = 0
        mask = (1 << width) - 1
        while b:
            if b & 1:
                result ^= a
            a <<= 1
            if a & (1 << width):
                a ^= irreducible
            a &= mask
            b >>= 1
        return result

    @staticmethod
    def GFMulGeneric(a, b, irreducible, field_size):
        result = 0
        mask = OpCodes.BitMask(field_size)
        high_bit = 1 << (field_size - 1)
        a &= mask
        b &= mask
        while b:
            if b & 1:
                result ^= a
            a <<= 1
            if a & (high_bit << 1):
                a ^= irreducible
            a &= mask
            b >>= 1
        return result & mask

    @staticmethod
    def SBoxLookup(sbox, input_val):
        return sbox[input_val & 0xFF]

    @staticmethod
    def MatrixMultiply4x4(matrix, column):
        result = [0, 0, 0, 0]
        for i in range(4):
            for j in range(4):
                result[i] ^= OpCodes.GF256Mul(matrix[i][j], column[j])
        return result

    @staticmethod
    def FeistelRound(left, right, round_key, f_function):
        f_output = f_function(right, round_key)
        return JSObject({"left": right, "right": left ^ f_output})

    @staticmethod
    def LFSRStep(state, polynomial, width):
        mask = (1 << width) - 1
        feedback = OpCodes.PopCount(state & polynomial) & 1
        return ((state >> 1) | (feedback << (width - 1))) & mask

    @staticmethod
    def LFSRStepGeneric(state, polynomial, width):
        mask = OpCodes.BitMask(width)
        feedback = OpCodes.PopCountFast(state & polynomial) & 1
        return ((state << 1) | feedback) & mask

    @staticmethod
    def PopCount(value):
        count = 0
        value &= 0xFFFFFFFFFFFFFFFF
        while value:
            count += value & 1
            value >>= 1
        return count

    @staticmethod
    def PopCountFast(value):
        count = 0
        value &= 0xFFFFFFFF
        while value:
            value &= value - 1
            count += 1
        return count

    @staticmethod
    def BitMask(bits):
        if bits >= 32:
            return 0xFFFFFFFF
        if bits <= 0:
            return 0
        return (1 << bits) - 1

    @staticmethod
    def GetBit(value, bit_index):
        return ((value >> bit_index) & 1) != 0

    @staticmethod
    def SetBit(value, bit_index, bit_value=True):
        return (value | (1 << bit_index)) & 0xFFFFFFFF if bit_value else (value & ~(1 << bit_index)) & 0xFFFFFFFF

    @staticmethod
    def GenerateRoundConstants(count, generator):
        return [generator(i) for i in range(count)]

    # ==================[ PERFORMANCE VARIANTS (same semantics) ]==================
    @staticmethod
    def FastXorArrays(arr1, arr2):
        return [(arr1[i] ^ arr2[i]) & 0xFF for i in range(len(arr1))]

    @staticmethod
    def FastXorInPlace(target, source, length=None):
        if length is None:
            length = min(len(target), len(source))
        for i in range(length):
            target[i] ^= source[i]

    @staticmethod
    def FastSubBytes(sbox, input_bytes):
        return [sbox[b] for b in input_bytes]

    @staticmethod
    def FastXorWords32(words1, words2):
        return [(words1[i] ^ words2[i]) & 0xFFFFFFFF for i in range(len(words1))]

    @staticmethod
    def BatchRotL32(values, positions):
        positions &= 31
        result = []
        for v in values:
            v &= 0xFFFFFFFF
            result.append(((v << positions) | (v >> (32 - positions))) & 0xFFFFFFFF if positions else v)
        return result

    @staticmethod
    def GetPooledArray(size):
        return [0] * size

    @staticmethod
    def ReturnToPool(array):
        pass

    @staticmethod
    def TimingSafeAddMod(a, b, m):
        s = (a + b) & 0xFFFFFFFF
        cmp = 1 if s >= m else 0
        mask = (0 - cmp) & 0xFFFFFFFF
        neg_m = (0 - m) & 0xFFFFFFFF
        return (s + (mask & neg_m)) & 0xFFFFFFFF

    @staticmethod
    def TimingSafeSelect(condition, a, b):
        bit = condition & 1
        mask = (0 - bit) & 0xFFFFFFFF
        return ((a & (~mask & 0xFFFFFFFF)) | (b & mask)) & 0xFFFFFFFF

    # ==================[ HASH ALGORITHM UTILITIES ]==================
    @staticmethod
    def Split64(value):
        return JSObject({"high32": (value >> 32) & 0xFFFFFFFF, "low32": value & 0xFFFFFFFF})

    @staticmethod
    def Combine64(high32, low32):
        return ((high32 & 0xFFFFFFFF) * 0x100000000) + (low32 & 0xFFFFFFFF)

    @staticmethod
    def EncodeMsgLength64LE(bit_length):
        split = OpCodes.Split64(bit_length)
        low_bytes = OpCodes.Unpack32LE(split.low32)
        high_bytes = OpCodes.Unpack32LE(split.high32)
        return low_bytes + high_bytes

    @staticmethod
    def EncodeMsgLength128BE(bit_length):
        split = OpCodes.Split64(bit_length)
        result = [0, 0, 0, 0, 0, 0, 0, 0]
        high_bytes = OpCodes.Unpack32BE(split.high32)
        low_bytes = OpCodes.Unpack32BE(split.low32)
        return result + high_bytes + low_bytes

    # ==================[ GCM / GHASH ]==================
    @staticmethod
    def GHashMul(x, y):
        if not x or len(x) != 16 or not y or len(y) != 16:
            raise Exception('GHashMul requires 16-byte arrays')
        z = [0] * 16
        v = list(y)
        for i in range(16):
            xi = x[i]
            for j in range(7, -1, -1):
                if xi & (1 << j):
                    for k in range(16):
                        z[k] = (z[k] ^ v[k]) & 0xFF
                lsb = v[15] & 1
                for k in range(15, 0, -1):
                    v[k] = ((v[k] >> 1) | ((v[k - 1] & 1) << 7)) & 0xFF
                v[0] = (v[0] >> 1) & 0xFF
                if lsb != 0:
                    v[0] = (v[0] ^ 0xE1) & 0xFF
        return z

    @staticmethod
    def GCMIncrement(counter):
        if not counter or len(counter) != 16:
            raise Exception('GCMIncrement requires 16-byte counter')
        carry = 1
        for i in range(15, 11, -1):
            s = counter[i] + carry
            counter[i] = s & 0xFF
            carry = s >> 8
        return counter

    # ==================[ 64-BIT (high,low) EMULATION - used by SHA-512/BLAKE etc. ]==================
    @staticmethod
    def Add64_HL(ah, al, bh, bl):
        l = (al & 0xFFFFFFFF) + (bl & 0xFFFFFFFF)
        h = (ah + bh + (l // 0x100000000)) & 0xFFFFFFFF
        return JSObject({"h": h, "l": l & 0xFFFFFFFF})

    @staticmethod
    def Add3L64(al, bl, cl):
        return (al & 0xFFFFFFFF) + (bl & 0xFFFFFFFF) + (cl & 0xFFFFFFFF)

    @staticmethod
    def Add3H64(low_sum, ah, bh, ch):
        return (ah + bh + ch + (low_sum // 0x100000000)) & 0xFFFFFFFF

    @staticmethod
    def RotR64_HL(high, low, n):
        n &= 63
        high &= 0xFFFFFFFF
        low &= 0xFFFFFFFF
        if n == 0:
            return JSObject({"h": high, "l": low})
        if n == 32:
            return JSObject({"h": low, "l": high})
        if n < 32:
            h = ((high >> n) | (low << (32 - n))) & 0xFFFFFFFF
            l = ((low >> n) | (high << (32 - n))) & 0xFFFFFFFF
            return JSObject({"h": h, "l": l})
        n -= 32
        h = ((low >> n) | (high << (32 - n))) & 0xFFFFFFFF
        l = ((high >> n) | (low << (32 - n))) & 0xFFFFFFFF
        return JSObject({"h": h, "l": l})

    @staticmethod
    def RotL64_HL(high, low, n):
        n &= 63
        high &= 0xFFFFFFFF
        low &= 0xFFFFFFFF
        if n == 0:
            return JSObject({"h": high, "l": low})
        if n == 32:
            return JSObject({"h": low, "l": high})
        if n < 32:
            h = ((high << n) | (low >> (32 - n))) & 0xFFFFFFFF
            l = ((low << n) | (high >> (32 - n))) & 0xFFFFFFFF
            return JSObject({"h": h, "l": l})
        n -= 32
        h = ((low << n) | (high >> (32 - n))) & 0xFFFFFFFF
        l = ((high << n) | (low >> (32 - n))) & 0xFFFFFFFF
        return JSObject({"h": h, "l": l})

    @staticmethod
    def Swap64_HL(high, low):
        return JSObject({"h": low & 0xFFFFFFFF, "l": high & 0xFFFFFFFF})

    @staticmethod
    def Xor64_HL(ah, al, bh, bl):
        return JSObject({"h": (ah ^ bh) & 0xFFFFFFFF, "l": (al ^ bl) & 0xFFFFFFFF})

    # Direct port of OpCodes.js's nested OpCodes.UInt64 namespace - a 64-bit
    # value is a plain [high32, low32] list (distinct from the {"h","l"}
    # JSObject shape Swap64_HL/Xor64_HL above use for a different call
    # convention already established elsewhere in this port). Referenced as
    # OpCodes.UInt64.<method>(...) (e.g. highway-hash.js) - see
    # transformMemberExpression's OpCodes-preservation branch, which keeps
    # both "UInt64" and every method name in their original JS casing so
    # this class actually resolves instead of folding to a nonexistent
    # snake_case attribute.
    class UInt64:
        @staticmethod
        def create(high, low):
            return [high & 0xFFFFFFFF, low & 0xFFFFFFFF]

        @staticmethod
        def fromBytes(data):
            b = list(data)
            if len(b) < 8:
                b = ([0] * (8 - len(b))) + b
            return [OpCodes.Pack32BE(b[0], b[1], b[2], b[3]), OpCodes.Pack32BE(b[4], b[5], b[6], b[7])]

        @staticmethod
        def toBytes(a):
            return OpCodes.Unpack32BE(a[0]) + OpCodes.Unpack32BE(a[1])

        @staticmethod
        def fromUInt16(words16):
            w = list(words16)
            if len(w) < 4:
                w = ([0] * (4 - len(w))) + w
            return [((w[0] & 0xFFFF) << 16) | (w[1] & 0xFFFF), ((w[2] & 0xFFFF) << 16) | (w[3] & 0xFFFF)]

        @staticmethod
        def toUInt16(a):
            return [(a[0] >> 16) & 0xFFFF, a[0] & 0xFFFF, (a[1] >> 16) & 0xFFFF, a[1] & 0xFFFF]

        @staticmethod
        def fromUInt32(words32):
            w = list(words32)
            if len(w) < 2:
                w = ([0] * (2 - len(w))) + w
            return [w[0] & 0xFFFFFFFF, w[1] & 0xFFFFFFFF]

        @staticmethod
        def toUInt32(a):
            return [a[0], a[1]]

        @staticmethod
        def add(a, b):
            low = (a[1] + b[1]) & 0xFFFFFFFF
            high = (a[0] + b[0] + (1 if low < a[1] else 0)) & 0xFFFFFFFF
            return [high, low]

        @staticmethod
        def sub(a, b):
            low = (a[1] - b[1]) & 0xFFFFFFFF
            high = (a[0] - b[0] - (1 if a[1] < b[1] else 0)) & 0xFFFFFFFF
            return [high, low]

        @staticmethod
        def mul(a, b):
            a0 = a[1] & 0xFFFF
            a1 = (a[1] >> 16) & 0xFFFF
            a2 = a[0] & 0xFFFF
            a3 = (a[0] >> 16) & 0xFFFF
            b0 = b[1] & 0xFFFF
            b1 = (b[1] >> 16) & 0xFFFF
            b2 = b[0] & 0xFFFF
            b3 = (b[0] >> 16) & 0xFFFF
            c0 = a0 * b0
            c1 = (a1 * b0 + a0 * b1 + (c0 >> 16)) & 0xFFFFFFFF
            c2 = (a2 * b0 + a1 * b1 + a0 * b2 + (c1 >> 16)) & 0xFFFFFFFF
            c3 = (a3 * b0 + a2 * b1 + a1 * b2 + a0 * b3 + (c2 >> 16)) & 0xFFFFFFFF
            return [((c3 & 0xFFFF) << 16) | (c2 & 0xFFFF), ((c1 & 0xFFFF) << 16) | (c0 & 0xFFFF)]

        @staticmethod
        def rotr(a, n):
            if n == 0:
                return a
            n = n % 64
            if n < 32:
                high = ((a[0] >> n) | ((a[1] << (32 - n)) & 0xFFFFFFFF)) & 0xFFFFFFFF
                low = ((a[1] >> n) | ((a[0] << (32 - n)) & 0xFFFFFFFF)) & 0xFFFFFFFF
                return [high, low]
            shift = n - 32
            high = ((a[1] >> shift) | ((a[0] << (32 - shift)) & 0xFFFFFFFF)) & 0xFFFFFFFF
            low = ((a[0] >> shift) | ((a[1] << (32 - shift)) & 0xFFFFFFFF)) & 0xFFFFFFFF
            return [high, low]

        @staticmethod
        def rotl(a, n):
            if n == 0:
                return a
            return OpCodes.UInt64.rotr(a, 64 - (n % 64))

        @staticmethod
        def shr(a, n):
            if n == 0:
                return a
            if n < 32:
                high = (a[0] >> n) & 0xFFFFFFFF
                low = ((a[1] >> n) | (a[0] << (32 - n))) & 0xFFFFFFFF
                return [high, low]
            return [0, (a[0] >> (n - 32)) & 0xFFFFFFFF]

        @staticmethod
        def shl(a, n):
            if n == 0:
                return a
            if n < 32:
                high = ((a[0] << n) | (a[1] >> (32 - n))) & 0xFFFFFFFF
                low = (a[1] << n) & 0xFFFFFFFF
                return [high, low]
            return [(a[1] << (n - 32)) & 0xFFFFFFFF, 0]

        @staticmethod
        def xor(a, b):
            return [(a[0] ^ b[0]) & 0xFFFFFFFF, (a[1] ^ b[1]) & 0xFFFFFFFF]

        @staticmethod
        def and_(a, b):
            return [(a[0] & b[0]) & 0xFFFFFFFF, (a[1] & b[1]) & 0xFFFFFFFF]

        @staticmethod
        def or_(a, b):
            return [(a[0] | b[0]) & 0xFFFFFFFF, (a[1] | b[1]) & 0xFFFFFFFF]

        @staticmethod
        def not_(a):
            return [(~a[0]) & 0xFFFFFFFF, (~a[1]) & 0xFFFFFFFF]

        @staticmethod
        def toNumber(a):
            return OpCodes.Combine64(a[0], a[1])

        @staticmethod
        def fromNumber(num):
            split = OpCodes.Split64(num)
            return [split["high32"], split["low32"]]

        @staticmethod
        def equals(a, b):
            return a[0] == b[0] and a[1] == b[1]

        @staticmethod
        def clone(a):
            return [a[0], a[1]]

    # ==================[ BIGINT-STYLE (plain Python ints) OPERATIONS ]==================
    @staticmethod
    def AndN(a, b):
        return a & b

    @staticmethod
    def OrN(a, b):
        return a | b

    @staticmethod
    def XorN(a, b):
        return a ^ b

    @staticmethod
    def And32(a, b):
        return (a & b) & 0xFFFFFFFF

    @staticmethod
    def Or32(a, b):
        return (a | b) & 0xFFFFFFFF

    @staticmethod
    def Not32(a):
        return (~a) & 0xFFFFFFFF

    @staticmethod
    def Xor32(a, b):
        return (a ^ b) & 0xFFFFFFFF

    @staticmethod
    def Add32(a, b):
        return (a + b) & 0xFFFFFFFF

    @staticmethod
    def Sub32(a, b):
        return (a - b) & 0xFFFFFFFF

    @staticmethod
    def Mul32(a, b):
        return (a * b) & 0xFFFFFFFF

    @staticmethod
    def MulHi32(a, b):
        return ((a & 0xFFFFFFFF) * (b & 0xFFFFFFFF)) >> 32

    @staticmethod
    def GetBitN(value, bit_index):
        return (value >> bit_index) & 1

    @staticmethod
    def SetBitN(value, bit_index, bit_value):
        mask = 1 << bit_index
        return (value | mask) if (bit_value & 1) else (value & ~mask)

    # ==================[ BIGINT MODULAR ARITHMETIC ]==================
    @staticmethod
    def MulModN(a, b, m):
        return ((a % m) * (b % m)) % m

    @staticmethod
    def SquareModN(a, m):
        reduced = a % m
        return (reduced * reduced) % m

    @staticmethod
    def ModPowN(base, exp, m):
        if m == 1:
            return 0
        if exp == 0:
            return 1
        result = 1
        base = base % m
        while exp > 0:
            if exp & 1:
                result = (result * base) % m
            exp >>= 1
            base = (base * base) % m
        return result

    @staticmethod
    def GcdN(a, b):
        a = -a if a < 0 else a
        b = -b if b < 0 else b
        while b != 0:
            a, b = b, a % b
        return a

    @staticmethod
    def BitCountN(value):
        if value == 0:
            return 1
        value = -value if value < 0 else value
        count = 0
        while value > 0:
            count += 1
            value >>= 1
        return count

    # ==================[ BITSTREAM ]==================
    @staticmethod
    def CreateBitStream(initial_bytes=None):
        return _BitStream(initial_bytes)

    # ==================[ HMAC ]==================
    # Real OpCodes.js has no HMAC() method - JS callers of the
    # "if (OpCodes && OpCodes.HMAC) return OpCodes.HMAC(key, message, hashName);"
    # fallback idiom (kdf2.js/hotp.js/totp.js/sp800-108-*.js) never actually
    # take this branch in Node; they succeed one branch earlier via
    # require('crypto').createHmac(). But that require('crypto') call is
    # unconditionally stripped out of the shared IL before any per-language
    # plugin (this one included) ever sees it - see type-aware-transpiler.js's
    # "Step 2.55: Strip require()-guarded fallback blocks", which resolves
    # every "if (typeof require !== 'undefined') {...}" guard to its
    # (missing) else-branch for every transpile target, Python included, so
    # there is no require('crypto') node left here to translate. Since that
    # shared stripping pass is out of bounds for this plugin, give Python's
    # OpCodes.HMAC a real stdlib-hmac-backed implementation instead so the
    # next fallback branch (previously a dead end - "Cannot compute HMAC:
    # No crypto library available") actually computes the right answer.
    # hmac.new(key, msg, digestmod) accepts a plain algorithm-name string
    # (e.g. "sha256") for digestmod without needing hashlib imported
    # separately - it resolves the name through hashlib internally. Returns
    # a list of ints (bytes), matching what the JS call site expects from
    # Array.from(hmac.digest()) on the require('crypto') path it replaces.
    @staticmethod
    def HMAC(key, message, hash_name):
        # hashlib/hmac algorithm names drop the dash for the common
        # SHA-1/SHA-256/SHA-512/MD5 names ("sha1", not "sha-1"/"sha_1"),
        # but keep an underscore for the SHA-3/SHAKE family ("sha3_256",
        # "shake_128") - handle both without a full name table since only
        # these two shapes occur across hashlib's algorithm set.
        algo = str(hash_name).lower().replace('-', '')
        if algo.startswith('sha3') and not algo.startswith('sha3_'):
            algo = 'sha3_' + algo[4:]
        elif algo.startswith('shake') and not algo.startswith('shake_'):
            algo = 'shake_' + algo[5:]
        key_bytes = bytes(bytearray(key)) if not isinstance(key, (bytes, bytearray)) else bytes(key)
        msg_bytes = bytes(bytearray(message)) if not isinstance(message, (bytes, bytearray)) else bytes(message)
        return list(hmac.new(key_bytes, msg_bytes, algo).digest())

    # "OpCodes && OpCodes.HMAC" existence-check operands go through the
    # generic member-access-in-a-logical-expression rewrite (see
    # _safeLogicalMemberOperand), which snake_cases/lowercases the attribute
    # name it probes with getattr() for JS-parity (a missing property reads
    # falsy, not AttributeError) - same rule every other bare "Foo &&
    # Foo.SomeMethod" truthiness probe in the transpiled algorithm files
    # relies on. The call "OpCodes.HMAC(...)" bypasses that rewrite (calls
    # go through transformOpCodesCall, which preserves the exact JS-side
    # method name/case), so both the lowercase probe and the original-case
    # call need to resolve to the same implementation.
    hmac = HMAC`,
        // Backs Array.prototype.splice() translation (transformArraySplice);
        // mutates the array in place and returns the removed elements, like JS.
        'SpliceArray': `def splice_array(arr, start, delete_count=0, items=None):
    items = items or []
    n = len(arr)
    if start < 0:
        start = max(n + start, 0)
    start = min(start, n)
    delete_count = max(0, min(delete_count, n - start))
    removed = list(arr[start:start + delete_count])
    arr[start:start + delete_count] = items
    return JSArray(removed)`,
        // JavaScript arrays auto-grow on out-of-bounds index assignment
        // (arr[i] = x extends the array with holes up to index i); Python
        // lists raise IndexError instead. This is a very common pattern in
        // table/S-box initialization code (arr = []; arr[i] = value in a
        // loop), so every array literal is emitted as JSArray(...) (see
        // emitList in PythonEmitter.js) to match JS semantics.
        // JS callback-taking array methods (forEach/find/findIndex/some/
        // every) are commonly called with a predicate written for only 1 of
        // the 3 JS-standard (element, index, array) callback parameters
        // (e.g. mdc2.js's `AlgorithmFramework.Algorithms.find(a => a.name
        // === "DES")`). These JSArray methods always have all 3 values
        // available and must offer them - but Python raises immediately
        // ("takes 1 positional argument but 3 were given") if the actual
        // function/lambda declares fewer parameters than are passed.
        // Introspect the callable's own arity and only pass what it accepts.
        '_js_arr_cb': 'def _js_arr_cb(fn, *args):\n' +
          '    try:\n' +
          '        code = fn.__code__\n' +
          '        if code.co_flags & 0x04:\n' +
          '            n = len(args)\n' +
          '        else:\n' +
          '            n = code.co_argcount\n' +
          '            if getattr(fn, "__self__", None) is not None:\n' +
          '                n -= 1\n' +
          '    except AttributeError:\n' +
          '        n = len(args)\n' +
          '    n = max(0, min(n, len(args)))\n' +
          '    return fn(*args[:n])',
        'JSArray': 'class JSArray(list):\n' +
          '    def __setitem__(self, index, value):\n' +
          '        if isinstance(index, slice):\n' +
          '            return list.__setitem__(self, index, value)\n' +
          '        i = index if index >= 0 else index + len(self)\n' +
          '        if i >= len(self):\n' +
          '            self.extend([0] * (i + 1 - len(self)))\n' +
          '        return list.__setitem__(self, i, value)\n' +
          '    def __getitem__(self, index):\n' +
          '        if isinstance(index, slice):\n' +
          '            return JSArray(list.__getitem__(self, index))\n' +
          '        try:\n' +
          '            return list.__getitem__(self, index)\n' +
          '        except IndexError:\n' +
          '            # JS arrays never raise on out-of-bounds reads (arr[i] for\n' +
          '            # i >= arr.length just evaluates to JS\'s empty/missing\n' +
          '            # value); Python lists raise IndexError instead. That empty\n' +
          '            # value coerces to 0 under the ToInt32/arithmetic coercions\n' +
          '            # this transpiled code universally wraps array reads in\n' +
          '            # (int(...), bitwise ops, +), so 0 is the closest faithful\n' +
          '            # stand-in - and, unlike None, it keeps downstream\n' +
          '            # int()/bitwise arithmetic from raising a second, more\n' +
          '            # confusing TypeError one level up.\n' +
          '            return 0\n' +
          '    def __add__(self, other):\n' +
          '        return JSArray(list.__add__(self, other))\n' +
          '    def copy(self):\n' +
          '        return JSArray(self)\n' +
          '    # JS Array.prototype method aliases - a defensive safety net for any\n' +
          '    # .push()/.shift()/etc. call that slips through untranslated (some\n' +
          '    # call shapes, e.g. arr.push(...spread), are not recognized by the\n' +
          '    # dedicated ArrayAppend/etc. IL transforms and fall back to a plain\n' +
          '    # method-call passthrough).\n' +
          '    def push(self, *values):\n' +
          '        self.extend(values)\n' +
          '        return len(self)\n' +
          '    def shift(self):\n' +
          '        return list.pop(self, 0) if len(self) else None\n' +
          '    def unshift(self, *values):\n' +
          '        self[0:0] = values\n' +
          '        return len(self)\n' +
          '    def indexOf(self, value, start=0):\n' +
          '        try:\n' +
          '            return self.index(value, start)\n' +
          '        except ValueError:\n' +
          '            return -1\n' +
          '    def includes(self, value):\n' +
          '        return value in self\n' +
          '    def slice(self, start=None, end=None):\n' +
          '        return JSArray(list.__getitem__(self, slice(start, end)))\n' +
          '    def concat(self, *others):\n' +
          '        result = JSArray(self)\n' +
          '        for o in others:\n' +
          '            result.extend(o if isinstance(o, (list, tuple)) else [o])\n' +
          '        return result\n' +
          '    def fill(self, value, start=0, end=None):\n' +
          '        end = len(self) if end is None else end\n' +
          '        for i in range(start, end):\n' +
          '            self[i] = value\n' +
          '        return self\n' +
          '    def join(self, sep=","):\n' +
          '        return sep.join(str(x) for x in self)\n' +
          '    def reverse(self):\n' +
          '        list.reverse(self)\n' +
          '        return self\n' +
          '    def forEach(self, fn):\n' +
          '        for _i, _v in enumerate(self):\n' +
          '            _js_arr_cb(fn, _v, _i, self)\n' +
          '    def find(self, fn):\n' +
          '        for _i, _v in enumerate(self):\n' +
          '            if _js_arr_cb(fn, _v, _i, self):\n' +
          '                return _v\n' +
          '        return None\n' +
          '    def findIndex(self, fn):\n' +
          '        for _i, _v in enumerate(self):\n' +
          '            if _js_arr_cb(fn, _v, _i, self):\n' +
          '                return _i\n' +
          '        return -1\n' +
          '    def some(self, fn):\n' +
          '        for _i, _v in enumerate(self):\n' +
          '            if _js_arr_cb(fn, _v, _i, self):\n' +
          '                return True\n' +
          '        return False\n' +
          '    def every(self, fn):\n' +
          '        for _i, _v in enumerate(self):\n' +
          '            if not _js_arr_cb(fn, _v, _i, self):\n' +
          '                return False\n' +
          '        return True',
        // JS Uint8Array/Int8Array/ArrayBuffer-backed byte buffers silently
        // truncate every store to its low 8 bits (`buf[i] = x` is really
        // `buf[i] = ToUint8(x)`, a real per-element coercion, not just a
        // range check) - overflow past 255 is routine in this codebase's
        // bit-mixing/permutation code (e.g. GF-field doubling: `block[i] =
        // (block[i] << 1) | carry`, which can reach 0x1FE before the
        // implicit truncation JS performs for free). Python's plain
        // bytearray instead raises "byte must be in range(0, 256)" the
        // instant an out-of-range int is stored, since it has no such
        // coercion. Every byte-typed-array construction site
        // (transformTypedArrayCreation/transformBufferCreation/etc.) emits
        // this subclass instead of a bare bytearray so every store gets the
        // same masking JS's engine applies for free - a no-op when the
        // value already fits (the overwhelmingly common case), so this is
        // safe even where the value was never going to overflow.
        // Slicing (`buf[a:b]`) is Python's own copy-out operation (not a
        // live view - see the separate subarray() handling), but the copy
        // is still logically a byte buffer, so it's re-wrapped to keep the
        // masking guarantee on any further writes into that copy.
        // Reads past the end mirror JSArray's own out-of-bounds handling
        // (see that stub's __getitem__ doc comment) for the same reason:
        // JS Uint8Array reads past its length evaluate to `undefined`
        // rather than throwing, and this codebase's transpiled code
        // consistently stores that value straight back into another byte
        // buffer slot (e.g. hash/blake2.js's `this._buf[j] = result[j]`
        // over a `result` shorter than 32 bytes on its last output block) -
        // Python's bytearray raises IndexError instead. 0 is the faithful
        // stand-in for the same reasoning JSArray's comment gives: it is
        // what `undefined` coerces to under ToUint8/bitwise-arithmetic,
        // and it keeps a subsequent int()/bitwise op from raising a second,
        // more confusing TypeError one level up.
        'JSUint8Array': 'class JSUint8Array(bytearray):\n' +
          '    def __setitem__(self, index, value):\n' +
          '        if isinstance(index, slice):\n' +
          '            if isinstance(value, int):\n' +
          '                return bytearray.__setitem__(self, index, value)\n' +
          '            return bytearray.__setitem__(self, index, bytes((int(v) & 0xFF) for v in value))\n' +
          '        return bytearray.__setitem__(self, index, int(value) & 0xFF)\n' +
          '    def __getitem__(self, index):\n' +
          '        if isinstance(index, slice):\n' +
          '            return JSUint8Array(bytearray.__getitem__(self, index))\n' +
          '        try:\n' +
          '            return bytearray.__getitem__(self, index)\n' +
          '        except IndexError:\n' +
          '            return 0\n' +
          '    def __add__(self, other):\n' +
          '        return JSUint8Array(bytearray.__add__(self, other))',
        // Backs `new ArrayBuffer(n)` (transformBufferCreation) - a DISTINCT
        // subclass from plain `new Uint8Array(n)` (JSUint8Array above) so
        // the multi-view-aliasing dispatch (_typed_array_view below) can
        // tell "a real ArrayBuffer, meant to be reinterpreted byte-for-byte
        // by every view built over it" apart from "an ordinary byte array
        // being copied element-by-element into a new TypedArray" - the two
        // have identical Python representations (both are just byte
        // sequences) but different JS constructor semantics: `new
        // Uint32Array(arrayBufferInstance)` reinterprets the buffer's raw
        // bytes as packed 32-bit words, while `new
        // Uint32Array(anyOtherArrayLike)` copies each element value as its
        // own word (see random/dsfmt.js's `buffer = new ArrayBuffer(8);
        // uint32View = new Uint32Array(buffer); float64View = new
        // Float64Array(buffer)` - both views must alias the SAME 8 bytes).
        'JSArrayBuffer': 'class JSArrayBuffer(JSUint8Array):\n    pass',
        // Backs a `new Uint32Array(buf)`/`new Float64Array(buf)`/etc. view
        // constructed over a real JSArrayBuffer (see _typed_array_view
        // below) - reads/writes (de)compose `width` little-endian bytes per
        // element directly into the SAME backing bytearray `buf`, so every
        // view built over the same buffer observes a sibling view's writes
        // immediately, matching real ArrayBuffer aliasing (see
        // random/dsfmt.js's `uint32View[0] = word; return float64View[0]`,
        // which only round-trips correctly if both views share the exact
        // same 8 bytes - a plain per-element list copy, what naive
        // `list(buffer)` gives, can never do this: each view would silently
        // own an independent copy). `fmt` is a struct format char ('f'/'d')
        // for float views, or None for a plain little-endian unsigned-
        // integer view.
        'JSTypedBufferView': 'class JSTypedBufferView:\n' +
          '    __slots__ = ("_buf", "_width", "_struct")\n' +
          '    def __init__(self, buf, width, fmt=None):\n' +
          '        self._buf = buf\n' +
          '        self._width = width\n' +
          '        if fmt:\n' +
          '            import struct as _struct\n' +
          '            self._struct = _struct.Struct("<" + fmt)\n' +
          '        else:\n' +
          '            self._struct = None\n' +
          '    def __len__(self):\n' +
          '        return len(self._buf) // self._width\n' +
          '    def _norm(self, index):\n' +
          '        return index + len(self) if index < 0 else index\n' +
          '    def _ensure(self, end_byte):\n' +
          '        if end_byte > len(self._buf):\n' +
          '            self._buf.extend(bytearray(end_byte - len(self._buf)))\n' +
          '    def __getitem__(self, index):\n' +
          '        if isinstance(index, slice):\n' +
          '            return [self[i] for i in range(*index.indices(len(self)))]\n' +
          '        i = self._norm(index) * self._width\n' +
          '        raw = bytes(self._buf[i:i + self._width])\n' +
          '        if len(raw) < self._width:\n' +
          '            raw = raw + bytes(self._width - len(raw))\n' +
          '        if self._struct:\n' +
          '            return self._struct.unpack(raw)[0]\n' +
          '        return int.from_bytes(raw, "little")\n' +
          '    def __setitem__(self, index, value):\n' +
          '        i = self._norm(index) * self._width\n' +
          '        self._ensure(i + self._width)\n' +
          '        raw = self._struct.pack(float(value)) if self._struct else (int(value) & ((1 << (8 * self._width)) - 1)).to_bytes(self._width, "little")\n' +
          '        self._buf[i:i + self._width] = raw\n' +
          '    def __iter__(self):\n' +
          '        for i in range(len(self)):\n' +
          '            yield self[i]\n' +
          '    def set(self, source, offset=0):\n' +
          '        for k, v in enumerate(list(source)):\n' +
          '            self[offset + k] = v\n' +
          '    def fill(self, value, start=0, end=None):\n' +
          '        end = len(self) if end is None else end\n' +
          '        for i in range(start, end):\n' +
          '            self[i] = value\n' +
          '        return self',
        // The reverse of JSTypedBufferView: a live byte-addressable view over
        // a JSUint32Array's WORD storage (e.g. `new Uint8Array(u32arr.buffer)`
        // - see _typed_array_bytes below) - reads/writes decompose/recompose
        // each word's 4 little-endian bytes in place, so a byte-level write
        // (e.g. kdf/argon2.js's `H0_8 = new Uint8Array(H0.buffer);
        // H0_8.set(bytes)`) lands in the SAME word list `H0` reads/writes
        // elsewhere - unlike a disconnected byte-snapshot copy (what the old
        // _u32_le_bytes-based dispatch produced), which silently discarded
        // the write, leaving H0 all-zero past the words it happened to set
        // directly.
        'JSBytesOfWordsView': 'class JSBytesOfWordsView:\n' +
          '    __slots__ = ("_words",)\n' +
          '    def __init__(self, words):\n' +
          '        self._words = words\n' +
          '    def __len__(self):\n' +
          '        return len(self._words) * 4\n' +
          '    def _norm(self, index):\n' +
          '        return index + len(self) if index < 0 else index\n' +
          '    def __getitem__(self, index):\n' +
          '        if isinstance(index, slice):\n' +
          '            return JSUint8Array(self[i] for i in range(*index.indices(len(self))))\n' +
          '        i = self._norm(index)\n' +
          '        try:\n' +
          '            w = int(self._words[i // 4])\n' +
          '        except IndexError:\n' +
          '            return 0\n' +
          '        return (w >> (8 * (i % 4))) & 0xFF\n' +
          '    def __setitem__(self, index, value):\n' +
          '        if isinstance(index, slice):\n' +
          '            values = list(value)\n' +
          '            rng = range(*index.indices(len(self)))\n' +
          '            for k, v in zip(rng, values):\n' +
          '                self[k] = v\n' +
          '            return\n' +
          '        i = self._norm(index)\n' +
          '        wi, sh = i // 4, 8 * (i % 4)\n' +
          '        while wi >= len(self._words):\n' +
          '            self._words.append(0)\n' +
          '        w = int(self._words[wi])\n' +
          '        v = int(value) & 0xFF\n' +
          '        self._words[wi] = ((w & ~(0xFF << sh)) & 0xFFFFFFFF) | (v << sh)\n' +
          '    def __iter__(self):\n' +
          '        for i in range(len(self)):\n' +
          '            yield self[i]\n' +
          '    def set(self, source, offset=0):\n' +
          '        for k, v in enumerate(list(source)):\n' +
          '            self[offset + k] = v',
        // Backs TypedArraySubarray (see transformTypedArraySubarray's doc
        // comment) - a live view aliasing a slice of another byte buffer,
        // matching JS TypedArray#subarray() semantics: reads AND writes go
        // through to the same backing storage the parent array uses,
        // unlike a plain Python slice (always an independent copy).
        // __buffer__ (PEP 688) lets this participate in the buffer
        // protocol like a real bytes-like object (hashlib.update(),
        // struct.pack_into(), etc.) by handing out a real memoryview
        // over the same backing buffer on demand.
        'JSUint8ArraySubarray': 'class JSUint8ArraySubarray:\n' +
          '    __slots__ = ("_buf", "_start", "_end")\n' +
          '    def __init__(self, buf, start=0, end=None):\n' +
          '        n = len(buf)\n' +
          '        s = start if start >= 0 else max(0, n + start)\n' +
          '        e = n if end is None else (end if end >= 0 else max(0, n + end))\n' +
          '        self._buf = buf\n' +
          '        self._start = min(s, n)\n' +
          '        self._end = max(self._start, min(e, n))\n' +
          '    def __len__(self):\n' +
          '        return self._end - self._start\n' +
          '    def _idx(self, i):\n' +
          '        if i < 0: i += len(self)\n' +
          '        if i < 0 or i >= len(self): raise IndexError("index out of range")\n' +
          '        return self._start + i\n' +
          '    def __getitem__(self, index):\n' +
          '        if isinstance(index, slice):\n' +
          '            s, e, _st = index.indices(len(self))\n' +
          '            return JSUint8ArraySubarray(self._buf, self._start + s, self._start + e)\n' +
          '        return self._buf[self._idx(index)]\n' +
          '    def __setitem__(self, index, value):\n' +
          '        if isinstance(index, slice):\n' +
          '            s, e, _st = index.indices(len(self))\n' +
          '            values = list(value)\n' +
          '            for k, v in enumerate(values):\n' +
          '                self._buf[self._start + s + k] = v\n' +
          '            return\n' +
          '        self._buf[self._idx(index)] = value\n' +
          '    def __iter__(self):\n' +
          '        for i in range(len(self)):\n' +
          '            yield self._buf[self._start + i]\n' +
          '    def __bytes__(self):\n' +
          '        return bytes(self._buf[self._start:self._end])\n' +
          '    def __buffer__(self, flags):\n' +
          '        return memoryview(self._buf)[self._start:self._end]\n' +
          '    def __repr__(self):\n' +
          '        return repr(bytearray(self._buf[self._start:self._end]))\n' +
          '    def set(self, source, offset=0):\n' +
          '        values = list(source)\n' +
          '        for k, v in enumerate(values):\n' +
          '            self._buf[self._start + offset + k] = v\n' +
          '    def subarray(self, begin=0, end=None):\n' +
          '        n = len(self)\n' +
          '        b = begin if begin >= 0 else max(0, n + begin)\n' +
          '        e = n if end is None else (end if end >= 0 else max(0, n + end))\n' +
          '        return JSUint8ArraySubarray(self._buf, self._start + b, self._start + e)',
        // Backs the generic (non-compile-time-detected-hex-literal)
        // `BigInt(x)` fallback (see the 'BigInt' funcName case) - `int(x)`
        // alone only handles a numeric x or a plain decimal string; it
        // raises ValueError on a "0x..."/"0o..."/"0b..." *runtime* string
        // (JS's real BigInt() constructor auto-detects those prefixes, same
        // as this helper). The prefix can only be checked once the value
        // exists - `BigInt(someVariable)` gives the transformer no literal
        // text to inspect at transpile time, unlike `BigInt('0x...')`
        // (handled separately, straight to `int(x, 16)`, no helper needed).
        // diffie-hellman.js's `BigInt(keyHex)` (keyHex built at runtime by
        // string concatenation) hit exactly this, raising "invalid literal
        // for int() with base 10" on its '0x'-prefixed result.
        '_bigint': 'def _bigint(x):\n    if isinstance(x, bool):\n        return int(x)\n    if isinstance(x, str):\n        s = x.strip()\n        if s[:1] in ("+", "-"):\n            sign, s = (-1 if s[0] == "-" else 1), s[1:]\n        else:\n            sign = 1\n        return sign * (int(s, 0) if s[:2].lower() in ("0x", "0o", "0b") else int(s))\n    return int(x)',
        // Backs `_computeJsonPreserveKeyLiterals`'s cross-method dataflow
        // trace (see its doc comment in PythonTransformer.js): registers,
        // by object identity, the {snake_key: original_js_key} pairs an
        // object literal several hops away from its eventual
        // JSON.stringify(...) call needs restored at serialization time -
        // the dict itself keeps its normal snake_cased keys internally (so
        // every OTHER reader, e.g. a destructuring assignment elsewhere,
        // still finds them), only `_json_default` below consults this table.
        // Keyed by id(obj) rather than holding a direct reference: a plain
        // attribute on the JSObject instance would leak into
        // keys()/values()/items()/entries() (every read of the *real* data),
        // corrupting any consumer that enumerates the object's own
        // properties instead of looking one up by name.
        '_json_preserve': '_JSON_KEY_ALIASES = {}\ndef _json_preserve(obj, aliases):\n    if aliases:\n        _JSON_KEY_ALIASES[id(obj)] = aliases\n    return obj',
        // JSON.stringify(obj) -> json.dumps(obj, default=_json_default) (see
        // both 'JsonSerialize' IL and the plain JSON.stringify(...)
        // MemberExpression call in transformMethodCall). Object literals in
        // transpiled code are wrapped in JSObject (see emitDict), which
        // json.dumps has no idea how to serialize on its own ("Object of
        // type JSObject is not JSON serializable") even though every JS
        // object literal is naturally JSON-serializable. `default` recurses:
        // json calls it again for any nested JSObject inside the returned
        // dict, so arbitrarily nested object literals round-trip correctly.
        // A JSObject registered with `_json_preserve` (see its doc comment)
        // gets its snake_cased keys swapped back to their original JS
        // spelling here, right before json.dumps sees them.
        '_json_default': 'def _json_default(o):\n    if isinstance(o, JSObject):\n        aliases = _JSON_KEY_ALIASES.get(id(o))\n        if aliases:\n            return {aliases.get(k, k): v for k, v in o.__dict__.items()}\n        return o.__dict__\n    return str(o)',
        // Backs `new Uint8Array(X.buffer)` where X is a `new
        // Uint32Array(...)` - see transformTypedArrayCreation(). JS
        // TypedArrays are little-endian on every real-world platform,
        // so reinterpreting a 32-bit-word buffer as bytes means each word
        // becomes exactly 4 little-endian bytes; naively treating the
        // words themselves as byte values (as if X already held bytes)
        // raises "byte must be in range(0, 256)" the first time any word
        // exceeds 255 (e.g. argon2.js's `new Uint32Array(1); T[0] =
        // dkLen` for dkLen=1024).
        // Marker subclass tagging a `new Uint32Array(...)`/`new
        // Int32Array(...)` result as holding 32-bit words rather than
        // bytes - otherwise behaves exactly like a plain list. See
        // _typed_array_bytes below and transformTypedArrayCreation's
        // JSUint32Array-tagging comment for why this needs to be a real
        // runtime-checkable type rather than a compile-time name lookup.
        'JSUint32Array': 'class JSUint32Array(list):\n    pass',
        // Dispatches a `new Uint8Array(X.buffer)`-style buffer reinterpret
        // (see transformTypedArrayCreation's isBufferPeel case) at RUNTIME
        // instead of trying to guess at transform time whether X held
        // 32-bit words or already-byte values - the transformer alone
        // cannot always tell (X may be a function parameter several calls
        // removed from wherever it was actually constructed). A
        // JSUint32Array-tagged X needs a LIVE byte view sharing X's own word
        // storage (JSBytesOfWordsView - a later write through this view, or
        // through X itself, must be visible through the other, see
        // kdf/argon2.js's `H0_8 = new Uint8Array(H0.buffer);
        // H0_8.set(bytes)` followed by direct `H0[17] = l` word writes and
        // further `new Uint8Array(H0.buffer)` peels, all needing to observe
        // each other's writes) - a one-shot decomposed bytearray COPY (what
        // this used to return) silently drops any write made through it.
        // Anything else is already byte-shaped and just needs the
        // 8-bit-masking JSUint8Array wrapper (see that stub's doc comment).
        '_typed_array_bytes': 'def _typed_array_bytes(x):\n    if isinstance(x, JSUint32Array):\n        return JSBytesOfWordsView(x)\n    return JSUint8Array(x)',
        // Dispatches a `new Uint32Array(buf)`/`new Float64Array(buf)`/etc.
        // construction (see transformTypedArrayCreation's isArrayCopy case)
        // at RUNTIME: only a REAL `new ArrayBuffer(...)` (tagged
        // JSArrayBuffer - see that stub's doc comment) is reinterpreted
        // byte-for-byte via a live JSTypedBufferView; a same-width `.buffer`
        // peel of another already-word-shaped JSUint32Array (e.g. `new
        // Uint32Array(otherU32.buffer)`) is already word-shaped - just alias
        // the SAME list, exactly like the JS view would share the same
        // words; every other array-like source (a regular list, or an
        // already-value-shaped TypedArray passed directly rather than via
        // `.buffer`) instead copies element-by-element, matching JS's real
        // TypedArray-from-array-like constructor behavior (distinct from the
        // TypedArray-from-ArrayBuffer reinterpret case) - preserved exactly
        // as before for every source that isn't a real ArrayBuffer.
        '_typed_array_view': 'def _typed_array_view(buffer, width, fmt=None):\n' +
          '    if isinstance(buffer, JSArrayBuffer):\n' +
          '        return JSTypedBufferView(buffer, width, fmt)\n' +
          '    if fmt is None and width == 4 and isinstance(buffer, JSUint32Array):\n' +
          '        return buffer\n' +
          '    if fmt:\n' +
          '        return [float(v) for v in buffer]\n' +
          '    if width == 4:\n' +
          '        return JSUint32Array(list(buffer))\n' +
          '    return list(buffer)',
        // JS `n.toString(radix)` for a non-decimal radix (almost always 2 or
        // 16 in this codebase, e.g. omega.js building a binary bit-string
        // digit-by-digit via `n.toString(2)`) - Python's builtin `str()` only
        // ever produces base 10, so blindly using it (as the generic
        // `toString` case does) emits decimal digit text where the caller
        // expects binary/hex digit text, e.g. later parsed back with
        // `int(chunk, 2)` ("invalid literal for int() with base 2: '66000000'"
        // - "660" being the decimal text for what should have been a short
        // binary run). No sign handling beyond a leading "-" is needed here:
        // every real call site radix-converts a small non-negative bit-field.
        '_int_to_base': 'def _int_to_base(n, base):\n    n = int(n)\n    if base == 10:\n        return str(n)\n    if n == 0:\n        return "0"\n    neg = n < 0\n    n = abs(n)\n    digits = "0123456789abcdefghijklmnopqrstuvwxyz"\n    out = []\n    while n > 0:\n        out.append(digits[n % base])\n        n //= base\n    if neg:\n        out.append("-")\n    return "".join(reversed(out))',
        // Backs transformArraySort - JS `arr.sort(cmp)` mutates `arr` in
        // place AND returns that same (now-sorted) reference, so both
        // usages need to keep working: as a bare statement whose only
        // effect is the mutation (e.g. classical/columnar.js's
        // `columns.sort((a, b) => ...)`, relied on entirely for its
        // side effect on `columns` - nothing reads the sort's return
        // value there) and as a chained/assigned expression. Python's
        // `sorted()` builtin - what this previously emitted - only does
        // the latter: it allocates a new list, leaving the original
        // variable untouched, so the bare-statement form silently sorts
        // nothing. `list.sort(key=...)` is Python's own in-place
        // equivalent, but it returns None (not the list) - wrapping it
        // here restores JS's "mutate AND yield the same reference"
        // contract in one expression.
        '_js_sort': 'def _js_sort(arr, key=None):\n    arr.sort(key=key)\n    return arr',
        // Backs the generic `.fill(value[, start[, end]])` method-call
        // fallback (see its call site's doc comment) - JS Array/TypedArray
        // #fill() mutates the receiver IN PLACE (and also returns that same
        // reference), exactly like Array#sort() (see _js_sort above for the
        // identical class of bug this mirrors). `[value] * len(arr)` (used
        // here previously) only ever builds a brand-new list - fine for the
        // immediate `new Array(n).fill(v)` construction idiom (a distinct,
        // correctly-mutation-free IL path - see transformArrayFill), but
        // silently a no-op for the equally common `existingArray.fill(v);`
        // bare-statement idiom on an already-declared array (e.g.
        // compression/lz4.js's `hashTable.fill(-1)`, relied on entirely to
        // reset match-position slots so an empty table reads as "no match"
        // - left at its Python default of 0, a self-match at position 0 is
        // read as "found", corrupting every compressed output).
        '_js_fill': 'def _js_fill(arr, value, start=0, end=None):\n    n = len(arr)\n    s = start if start >= 0 else max(0, n + start)\n    e = n if end is None else (end if end >= 0 else max(0, n + end))\n    for i in range(s, e):\n        arr[i] = value\n    return arr',
        // Backs Object.keys/values/entries (see their IL 'ObjectKeys'/
        // 'ObjectValues'/'ObjectEntries' case doc comments). A JS object's
        // OWN property enumeration order is NOT plain insertion order -
        // per the ECMAScript OwnPropertyKeys algorithm, every key that's a
        // canonical non-negative integer string ("0", "1", ... - an
        // "array index") is yielded FIRST, ascending numerically, ahead of
        // every other (non-integer-like) string key, which keeps its
        // insertion order. A Python dict (what JSObject.__dict__ - and
        // json.loads()'s own plain dicts - actually store keys in) has no
        // such reordering, only ever insertion order - so an
        // integer-keyed frequency/lookup table built via `freq[byte] =
        // (freq[byte] || 0) + 1` (e.g. compression/rolz.js's
        // `_packCompressed`, serializing `Object.entries(frequencies)`
        // straight into the compressed output's byte stream) silently
        // serializes its entries in first-seen order instead of ascending
        // byte-value order - byte-for-byte different from what the real
        // JS produces even though every individual (key, value) pair is
        // itself correct.
        '_js_object_keys': 'def _js_object_keys(d):\n    keys = list(d.keys()) if hasattr(d, "keys") else list(d)\n    int_keys = []\n    other_keys = []\n    for k in keys:\n        ks = str(k)\n        if ks == "0" or (ks and ks[0] != "0" and ks.isdigit()):\n            int_keys.append(k)\n        else:\n            other_keys.append(k)\n    int_keys.sort(key=lambda x: int(x))\n    return int_keys + other_keys',
        '_js_object_values': 'def _js_object_values(d):\n    return [d[k] for k in _js_object_keys(d)]',
        '_js_object_entries': 'def _js_object_entries(d):\n    return [(k, d[k]) for k in _js_object_keys(d)]',
      };
      // Fixed emission order so base classes (LinkItem) are always defined before
      // subclasses (TestCase, Vulnerability) regardless of Set insertion order.
      const HELPER_ORDER = ['JSObject', '_js_arr_cb', 'JSArray', 'JSUint8Array', 'JSArrayBuffer', 'JSUint8ArraySubarray', 'JSUint32Array', 'JSTypedBufferView', 'JSBytesOfWordsView', 'BitStream', 'OpCodes', 'SpliceArray', '_bigint', '_json_preserve', '_json_default', '_typed_array_bytes', '_typed_array_view', '_int_to_base', '_js_sort', '_js_fill', '_js_object_keys', '_js_object_values', '_js_object_entries', 'LinkItem', 'TestCase', 'Vulnerability', 'KeySize', 'AuthResult'];
      // TestCase/Vulnerability both extend LinkItem in the real framework.
      if (this.helperClasses.has('TestCase') || this.helperClasses.has('Vulnerability'))
        this.helperClasses.add('LinkItem');

      // Enum constants - real members match AlgorithmFramework.js; a metaclass
      // __getattr__ fallback returns None for any other member so that algorithm
      // files using nonstandard/typo'd members (e.g. CountryCode.ZA, ComplexityType.BASIC)
      // behave like JavaScript's silent `undefined` instead of raising AttributeError.
      const ENUM_STUBS = {
        'category_type': 'class CategoryType(metaclass=_EnumMeta):\n    ASYMMETRIC = "asymmetric"\n    BLOCK = "block"\n    STREAM = "stream"\n    HASH = "hash"\n    CHECKSUM = "checksum"\n    COMPRESSION = "compression"\n    ENCODING = "encoding"\n    CLASSICAL = "classical"\n    MAC = "mac"\n    KDF = "kdf"\n    ECC = "ecc"\n    MODE = "mode"\n    PADDING = "padding"\n    AEAD = "aead"\n    SPECIAL = "special"\n    PQC = "pqc"\n    RANDOM = "random"\n    ASYMMETRIC_CIPHER = "asymmetric"\ncategory_type = CategoryType()',
        'security_status': 'class SecurityStatus(metaclass=_EnumMeta):\n    SECURE = "secure"\n    DEPRECATED = "deprecated"\n    BROKEN = "broken"\n    INSECURE = "broken"\n    OBSOLETE = "obsolete"\n    EXPERIMENTAL = "experimental"\n    EDUCATIONAL = "educational"\n    ACTIVE = "secure"\nsecurity_status = SecurityStatus()',
        'complexity_type': 'class ComplexityType(metaclass=_EnumMeta):\n    BEGINNER = "beginner"\n    INTERMEDIATE = "intermediate"\n    ADVANCED = "advanced"\n    EXPERT = "expert"\n    RESEARCH = "research"\n    BASIC = "beginner"\n    ELEMENTARY = "beginner"\n    SIMPLE = "beginner"\n    TRIVIAL = "beginner"\n    LOW = "beginner"\n    MEDIUM = "intermediate"\n    HIGH = "advanced"\ncomplexity_type = ComplexityType()',
        'country_code': 'class CountryCode(metaclass=_EnumMeta):\n    US = "US"\n    GB = "GB"\n    UK = "GB"\n    DE = "DE"\n    FR = "FR"\n    FRANCE = "FR"\n    JP = "JP"\n    CN = "CN"\n    RU = "RU"\n    UA = "UA"\n    IL = "IL"\n    BE = "BE"\n    KR = "KR"\n    AU = "AU"\n    CA = "CA"\n    CH = "CH"\n    NL = "NL"\n    NETHERLANDS = "NL"\n    SE = "SE"\n    NO = "NO"\n    FI = "FI"\n    AT = "AT"\n    AUSTRIA = "AT"\n    ES = "ES"\n    IT = "IT"\n    PL = "PL"\n    PT = "PT"\n    BR = "BR"\n    IN = "IN"\n    SG = "SG"\n    SINGAPORE = "SG"\n    DK = "DK"\n    GR = "GR"\n    CR = "CR"\n    TR = "TR"\n    ID = "ID"\n    EU = "EU"\n    ZA = "ZA"\n    INTL = "INTL"\n    INTERNATIONAL = "INTL"\n    INT = "INTL"\n    MULTI = "INTL"\n    ANCIENT = "ANCIENT"\n    UNKNOWN = "UNKNOWN"\ncountry_code = CountryCode()',
      };

      // Emit every base-class stub unconditionally — they are trivial and this
      // guarantees any `class X(SomeBase)` resolves regardless of whether the
      // inheritance tracker recognized the base (it can miss member-expression
      // bases like AlgorithmFramework.AeadAlgorithm).
      for (const name of [...ALGORITHM_BASES, ...INSTANCE_BASES]) {
        stubs.push({ nodeType: 'RawCode', code: FRAMEWORK_STUBS[name] });
      }

      // Emit every helper stub unconditionally, in dependency order (LinkItem
      // before TestCase/Vulnerability which extend it) - same rationale as the
      // base-class stubs above: trivial, side-effect-free, and immune to gaps
      // in usage detection (destructuring, member-expression bases, etc.)
      for (const name of HELPER_ORDER) {
        stubs.push({ nodeType: 'RawCode', code: HELPER_STUBS[name] });
      }

      // Enum metaclass (shared __getattr__ fallback) + every enum stub, always.
      stubs.push({ nodeType: 'RawCode', code: 'class _EnumMeta(type):\n    def __getattr__(cls, name): return None' });
      for (const enumName of Object.keys(ENUM_STUBS)) {
        stubs.push({ nodeType: 'RawCode', code: ENUM_STUBS[enumName] });
      }

      // register_algorithm()/AlgorithmFramework are emitted unconditionally
      // (like the base-class and helper stubs above) rather than gated on
      // usage detection - both are trivial and detection can miss call
      // shapes (bare AlgorithmFramework truthiness checks, aliasing, etc.)
      // The register_algorithm function stores the algorithm in a global
      // variable so the test harness can access the registered instance.
      // Also keeps a canonical `algorithm_instance` global pointed at
      // whichever algorithm was registered LAST. The single-file test
      // harness bundles a file's algorithm alongside any dependency it
      // looks up by name at runtime (e.g. a KDF/MAC pulling in sha1.js so
      // AlgorithmFramework.Find('SHA-1') resolves) and then grabs "the"
      // algorithm to test via a bare `algorithm_instance` name lookup.
      // Many hash/algorithm files happen to name their own top-level
      // instance variable `algorithmInstance` (-> snake_case
      // `algorithm_instance`) as a coincidental convention - when such a
      // file is bundled as a *dependency* ahead of the real target file
      // (which conventionally uses its own class-derived name, e.g.
      // `kdf1Algorithm`/`kdf1ISOAlgorithm`, not `algorithmInstance`), that
      // bare lookup resolves to the dependency's leftover module-level
      // variable instead of the target's own registration, even though
      // `register_algorithm()` was already called again afterwards for the
      // real target. Assigning this same canonical name on every
      // registration (last call wins, matching `_registered_algorithm`)
      // means the harness's lookup always reflects the most recently
      // registered algorithm regardless of what any bundled dependency
      // happened to name its own local variable.
      stubs.push({ nodeType: 'RawCode', code: '_registered_algorithm = None\ntry:\n    _algorithms_by_name\nexcept NameError:\n    _algorithms_by_name = {}\ndef register_algorithm(algo):\n    global _registered_algorithm, algorithm_instance\n    _registered_algorithm = algo\n    algorithm_instance = algo\n    try:\n        _algorithms_by_name[algo.name] = algo\n    except Exception:\n        pass\n    return algo' });
      // str.replace()/replaceAll() route through this helper (both the plain
      // string-search and regex-literal-search paths - regex literals become
      // re.compile(...) objects, see transformLiteral) so a single place
      // mirrors JavaScript's semantics: None strings pass through as None,
      // a re.Pattern search uses .sub(), and is_global picks between
      // replace-all (String.replaceAll / regex with the 'g' flag) and
      // replace-first-occurrence (String.replace with a plain string or a
      // non-global regex).
      // `.length` reads route through this helper rather than a bare
      // len(...) call (see transformArrayLength): JS makes no syntactic
      // distinction between array.length and a plain object's own .length
      // field (e.g. a match-finder returning {length, distance}), so the
      // type-aware IL pass turns every `.length` access into the same node.
      // For real lists/strings/dicts/JSArray this behaves exactly like
      // len(...); for anything else (JSObject, or any custom class) it
      // reads the .length attribute instead of raising "object of type 'X'
      // has no len()".
      // Map/dict-like .set(key, value) that the type-aware IL pass didn't
      // recognize as an actual Map (see the `methodName === 'set'` fallback
      // in transformCallExpression) - subscript-assigns and returns the
      // container so it also works as an expression, not just a statement.
      stubs.push({
        nodeType: 'RawCode', code:
          'def _map_set(obj, key, value):\n' +
          '    obj[key] = value\n' +
          '    return obj'
      });
      // Backs `.delete(key)` (see the `methodName === 'delete'` case in
      // transformCallExpression) - a real `new Map()` is now a plain dict
      // (transformMapCreation), which has no .delete() method (only
      // .pop()); a JSObject (the object-literal-as-map idiom) already
      // defines its own .delete(), so just delegate to that instead of
      // reimplementing it here. Returns the same boolean JS's real
      // Map.prototype.delete() does (whether the key was actually present).
      stubs.push({
        nodeType: 'RawCode', code:
          'def _map_delete(obj, key):\n' +
          '    if isinstance(obj, dict):\n' +
          '        return obj.pop(key, None) is not None\n' +
          '    return obj.delete(key)'
      });
      stubs.push({
        nodeType: 'RawCode', code:
          'def _js_len(x):\n' +
          '    try:\n' +
          '        return len(x)\n' +
          '    except TypeError:\n' +
          '        return getattr(x, "length", 0)'
      });
      // Backs a computed subscript read (`seq[idx]`) used as an operand of
      // `||`/`&&` (e.g. kdf/bcrypt.js's base64 decoder: `str[i++] || '.'`,
      // walking `i` past the end of a not-always-multiple-of-4-length salt
      // string) - see _safeLogicalMemberOperand's computed-access branch.
      // JS bracket access past an array/string's length (or with a negative
      // index - never a valid JS array index) silently yields `undefined`,
      // which is exactly what such a `||`-guarded read relies on to fall
      // back to its default; Python's list/str/bytes `__getitem__` raises
      // IndexError instead, and a plain dict (the JSObject-as-map idiom)
      // raises KeyError - aborting the whole call rather than taking the
      // fallback branch. Only these two exceptions are swallowed (anything
      // else - e.g. a genuine TypeError from indexing something that isn't
      // subscriptable at all - is a real bug and must still propagate).
      stubs.push({
        nodeType: 'RawCode', code:
          'def _js_idx(seq, idx):\n' +
          '    try:\n' +
          '        return seq[idx]\n' +
          '    except (IndexError, KeyError):\n' +
          '        return None'
      });
      // Backs `parseInt(x)`/`parseInt(x, radix)` (see the transformCallExpression
      // 'parseInt' branch's doc comment) - unlike Python's strict int(), JS's
      // parseInt never raises: it skips leading whitespace/sign, parses as
      // many leading valid-for-the-radix digits as it can find, ignores any
      // trailing garbage, and returns NaN if there wasn't even one valid
      // leading digit. A radix of 0/None with a "0x"/"0X"-prefixed string
      // auto-detects hex (JS's own auto-detection rule since ES5; the legacy
      // ES3 leading-"0"-means-octal rule is gone and intentionally NOT
      // replicated here).
      stubs.push({
        nodeType: 'RawCode', code:
          'def _js_parse_int(s, radix=None):\n' +
          '    if isinstance(s, bool):\n' +
          '        s = "1" if s else "0"\n' +
          '    elif not isinstance(s, str):\n' +
          '        s = str(s)\n' +
          '    s = s.strip()\n' +
          '    i = 0\n' +
          '    n = len(s)\n' +
          '    neg = False\n' +
          '    if i < n and s[i] in "+-":\n' +
          '        neg = s[i] == "-"\n' +
          '        i += 1\n' +
          '    base = int(radix) if radix else 0\n' +
          '    if base == 0:\n' +
          '        if s[i:i + 2].lower() == "0x":\n' +
          '            base = 16\n' +
          '            i += 2\n' +
          '        else:\n' +
          '            base = 10\n' +
          '    elif base == 16 and s[i:i + 2].lower() == "0x":\n' +
          '        i += 2\n' +
          '    if base < 2 or base > 36:\n' +
          '        return float("nan")\n' +
          '    valid = "0123456789abcdefghijklmnopqrstuvwxyz"[:base]\n' +
          '    start = i\n' +
          '    while i < n and s[i].lower() in valid:\n' +
          '        i += 1\n' +
          '    if i == start:\n' +
          '        return float("nan")\n' +
          '    value = int(s[start:i], base)\n' +
          '    return -value if neg else value'
      });
      stubs.push({
        nodeType: 'RawCode', code:
          'def safe_replace(s, search, replacement, is_global=True):\n' +
          '    if s is None:\n' +
          '        return None\n' +
          '    s = str(s)\n' +
          '    rep = "" if replacement is None else str(replacement)\n' +
          '    if hasattr(search, "sub") and hasattr(search, "pattern"):\n' +
          '        rep = rep.replace("\\\\", "\\\\\\\\")\n' +
          '        return search.sub(rep, s) if is_global else search.sub(rep, s, count=1)\n' +
          '    needle = "" if search is None else str(search)\n' +
          '    if needle == "":\n' +
          '        return s\n' +
          '    return s.replace(needle, rep) if is_global else s.replace(needle, rep, 1)'
      });
      // AlgorithmFramework.KeySize(...)/LinkItem(...)/etc (constructor-style,
      // as opposed to `new KeySize(...)`) become AlgorithmFramework.key_size(...)
      // via the generic method-call fallback, so expose the real classes as
      // callable attributes under their snake_case names.
      stubs.push({
        nodeType: 'RawCode', code:
          // Real AlgorithmFramework.Algorithms is a live array of every
          // registered algorithm instance, read directly off the class
          // (e.g. mdc2.js's `AlgorithmFramework.Algorithms.find(a => a.name
          // === "DES")` - a predicate search, distinct from
          // AlgorithmFramework.Find(name)'s name lookup). A plain
          // `@property` only evaluates through an INSTANCE, not class-level
          // access (`AlgorithmFramework.algorithms` would just return the
          // property descriptor object itself, which has no `.find`) - a
          // metaclass property is the only way to make class-level
          // attribute access itself run code.
          'class _AlgorithmFrameworkMeta(type):\n' +
          '    @property\n' +
          '    def algorithms(cls): return JSArray(list(_algorithms_by_name.values()))\n' +
          'class AlgorithmFramework(metaclass=_AlgorithmFrameworkMeta):\n' +
          '    register_algorithm = staticmethod(register_algorithm)\n' +
          '    key_size = KeySize\n' +
          '    link_item = LinkItem\n' +
          '    test_case = TestCase\n' +
          '    vulnerability = Vulnerability\n' +
          '    auth_result = AuthResult\n' +
          '    category_type = category_type\n' +
          '    security_status = security_status\n' +
          '    complexity_type = complexity_type\n' +
          '    country_code = country_code\n' +
          '    @staticmethod\n' +
          '    def find(name): return _algorithms_by_name.get(name)\n' +
          'algorithm_framework = AlgorithmFramework()'
      });

      return stubs;
    }

    /**
     * Collect necessary imports based on what was used
     */
    collectImports() {
      const imports = [];

      // Always add typing imports for type annotations
      if (this.imports.has('List') || this.imports.has('Dict') ||
          this.imports.has('Optional') || this.imports.has('Any')) {
        const typingItems = [];
        if (this.imports.has('List')) typingItems.push({ name: 'List', alias: null });
        if (this.imports.has('Dict')) typingItems.push({ name: 'Dict', alias: null });
        if (this.imports.has('Optional')) typingItems.push({ name: 'Optional', alias: null });
        if (this.imports.has('Any')) typingItems.push({ name: 'Any', alias: null });
        imports.push(new PythonImport('typing', typingItems));
      }

      // Add struct import if needed
      if (this.imports.has('struct')) {
        imports.push(new PythonImport('struct', null));  // null = 'import struct', not 'from struct import'
      }

      // Add re import if needed (regex literals -> re.compile(...))
      if (this.imports.has('re')) {
        imports.push(new PythonImport('re', null));  // null = 'import re'
      }

      // Add math import if needed
      if (this.imports.has('math')) {
        imports.push(new PythonImport('math', null));  // null = 'import math'
      }

      // Add random import if needed
      if (this.imports.has('random')) {
        imports.push(new PythonImport('random', null));  // null = 'import random'
      }

      // Add functools import if needed
      if (this.imports.has('functools')) {
        imports.push(new PythonImport('functools', null));  // null = 'import functools'
      }

      // Add json import if needed
      if (this.imports.has('json')) {
        imports.push(new PythonImport('json', null));  // null = 'import json'
      }

      // Add copy import if needed (deep-clone idiom: JSON.parse(JSON.stringify(x)))
      if (this.imports.has('copy')) {
        imports.push(new PythonImport('copy', null));  // null = 'import copy'
      }

      // Add datetime import if needed
      if (this.imports.has('datetime')) {
        imports.push(new PythonImport('datetime', null));  // null = 'import datetime'
      }

      // Add time import if needed (performance.now() -> time.perf_counter())
      if (this.imports.has('time')) {
        imports.push(new PythonImport('time', null));  // null = 'import time'
      }

      // `hmac` backs OpCodes.HMAC (see the 'OpCodes' HELPER_STUBS entry,
      // emitted unconditionally alongside JSObject/BitStream/etc. per
      // HELPER_ORDER) - import it unconditionally too rather than trying to
      // detect every OpCodes.HMAC call site up front.
      imports.push(new PythonImport('hmac', null));

      return imports;
    }

    /**
     * Check if a method is just a wrapper that calls another method with the same snake_case name.
     * This detects patterns like:
     *   Init() { this.init(); }  // where Init -> init in snake_case
     *   Reset() { this.reset(); }
     * These would create infinite recursion in Python since both map to the same name.
     */
    _isWrapperCallingMethod(methodNode, targetSnakeName) {
      if (!methodNode.value || !methodNode.value.body) return false;

      const body = methodNode.value.body;
      // Check if body is a BlockStatement with a single ExpressionStatement
      if (body.type !== 'BlockStatement') return false;
      if (!body.body || body.body.length !== 1) return false;

      const stmt = body.body[0];
      // Check for ExpressionStatement containing a CallExpression
      if (stmt.type !== 'ExpressionStatement') return false;

      const expr = stmt.expression;
      if (!expr || expr.type !== 'CallExpression') return false;

      // Check if it's a this.methodName() call
      const callee = expr.callee;
      if (!callee || callee.type !== 'MemberExpression') return false;
      if (callee.object.type !== 'ThisExpression') return false;
      if (callee.property.type !== 'Identifier') return false;

      // Check if the called method name maps to the same snake_case name
      const calledMethodName = toSnakeCase(callee.property.name);
      return calledMethodName === targetSnakeName;
    }

    /**
     * Transform Program node
     */
    transformProgram(node, module) {
      // Legacy `function Ctor(){...}` + `Ctor.prototype =
      // Object.create(Base.prototype)` inheritance idiom (see
      // `_flattenLegacyPrototypeOOP`'s doc comment) - must run before
      // anything below reads `node.body` so the synthesized/`superClass`-
      // patched class and the two dropped statements are already in their
      // final shape for the rest of this pass (moduleConstTag detection,
      // the main per-statement transform loop, ...).
      this._flattenLegacyPrototypeOOP(node);

      // Light cross-method dataflow trace for JSON.stringify key-casing
      // (see `_computeJsonPreserveKeyLiterals`'s doc comment) - run once, up
      // front, over the whole file so every 'ObjectLiteral' case below can
      // do an O(1) Set lookup instead of re-deriving this per node.
      this._computeJsonPreserveKeyLiterals(node);

      // Per-file namespace tag for disambiguating short, generic top-level
      // constant-table names (K, H, IV, SBOX, RCON, ...) - see the rename
      // logic in transformVariableDeclaration/transformIdentifier. JS scopes
      // these to the file's own closure (the UMD factory function body), so
      // e.g. sha1.js's, sha256.js's, and sha512.js's own separate `const K =
      // [...]` (three DIFFERENT round-constant tables) never collide there.
      // The single-file test harness (and, per the task brief, potentially
      // real multi-hash-dependent KDF/MAC/signature code too) concatenates
      // several transpiled files into one flat Python module/namespace,
      // where these bare module-level names collide - whichever file's
      // assignment runs LAST silently overwrites the others' same-named
      // global, corrupting every hash that isn't the last one loaded (e.g.
      // kdf1.js requiring sha1.js + sha256.js + sha512.js: SHA-1's `hash()`
      // reads the global name `K` at call time and got SHA-512's table
      // instead of its own). Tag every such name with the file's first
      // declared class name so the same source file always produces the
      // same identifier (stable for cross-references within this file) but
      // different files essentially never collide.
      let moduleConstTag = null;
      for (const stmt of node.body) {
        if (stmt.type === 'ClassDeclaration' && stmt.id && stmt.id.name) {
          moduleConstTag = stmt.id.name;
          break;
        }
      }
      this.moduleConstRenames = new Map();
      if (moduleConstTag) {
        // Matches K, H, IV, SBOX, RCON, S0..S7, T0..T3, C, N, W, P, Q -
        // short (<= 8 chars), all-caps-and-digits identifiers, the
        // near-universal convention for round/S-box/permutation constant
        // tables in this codebase. Longer or mixed-case top-level names are
        // already specific enough in practice to be vanishingly unlikely to
        // collide, so they're left untouched to minimize blast radius.
        const CONST_TABLE_NAME_RE = /^[A-Z][A-Z0-9_]{0,7}$/;
        for (const stmt of node.body) {
          if (stmt.type !== 'VariableDeclaration') continue;
          for (const d of stmt.declarations || []) {
            if (d.id && d.id.type === 'Identifier' && CONST_TABLE_NAME_RE.test(d.id.name) &&
                !this.moduleConstRenames.has(d.id.name)) {
              this.moduleConstRenames.set(d.id.name, `${d.id.name}__${toSnakeCase(moduleConstTag)}`);
            }
          }
        }
      }

      // Pre-pass: record top-level let/const/var names (see moduleLevelVarNames)
      // before transforming anything, so function declarations anywhere in the
      // file can detect closures over them. Modern parsers/type-aware-transpiler
      // typically unwrap the UMD/IIFE wrapper before this point, so top-level
      // declarations usually arrive directly in node.body rather than through
      // extractDeclarationsFromBody (which has the same pre-pass for the case
      // where unwrapping happens locally instead).
      for (const stmt of node.body) {
        if (stmt.type === 'VariableDeclaration') {
          for (const d of stmt.declarations || []) {
            if (d.id && d.id.type === 'Identifier') {
              // Use the same renamed form moduleConstRenames/transformIdentifier
              // resolve this name to (see above) - otherwise a lazy-init
              // reassignment from inside a nested function/method (e.g.
              // kalyna.js's module-level `let IS = null;` later reassigned
              // via `if (!IS) { IS = []; ... }` inside a function) looks up
              // the ORIGINAL bare name here, never finds it in
              // moduleLevelVarNames under its renamed spelling, and so never
              // gets the `global IS__kalyna_algorithm` declaration that
              // reassignment needs - Python then treats the assignment as
              // creating a brand new local, and the `if (!IS...)` read
              // immediately before it raises UnboundLocalError instead of
              // seeing the real module-level value.
              const renamed = this.moduleConstRenames.has(d.id.name)
                ? this.moduleConstRenames.get(d.id.name)
                : toSnakeCase(d.id.name);
              this.moduleLevelVarNames.add(renamed);
            }
          }
        }
      }

      // JS function declarations are fully hoisted above every other
      // top-level statement in their scope, so `const TABLE =
      // buildTable();` can legally call a `function buildTable() {...}`
      // declared later in the same file. Python has no such hoisting -
      // module code runs strictly top-to-bottom - so pushing statements in
      // pure source order (as this loop used to) raises NameError the first
      // time a module-level constant is initialized from a helper function
      // defined further down. Collect top-level function declarations
      // separately and splice them in ahead of everything else, mirroring
      // JS's actual runtime visibility; every other statement keeps its
      // relative source order.
      const moduleStmts = [];
      const hoistedFunctions = [];
      for (const stmt of node.body) {
        // Handle IIFE wrappers at top level - extract content from inside
        if (stmt.type === 'ExpressionStatement' && stmt.expression?.type === 'CallExpression') {
          const callee = stmt.expression.callee;
          if (callee.type === 'FunctionExpression' || callee.type === 'ArrowFunctionExpression') {
            // Extract and process IIFE body content
            const extracted = this.transformIIFEContent(callee, stmt.expression);
            if (extracted) {
              if (Array.isArray(extracted)) {
                moduleStmts.push(...extracted);
              } else {
                moduleStmts.push(extracted);
              }
            }
            continue;
          }
        }

        // Skip Node.js main entry point check: if (require.main === module) { ... }
        // These are test/demo code blocks not needed in transpiled output
        // Also skip CommonJS dependency-loading guards: if (typeof require !== 'undefined') { require(...) }
        // 'require' has no meaning in Python and these blocks only lazy-load sibling
        // algorithm files that are irrelevant when transpiling a single algorithm.
        if (stmt.type === 'IfStatement') {
          if (this.isNodeMainCheck(stmt.test) || this.isRequireGuard(stmt.test)) {
            continue;
          }
        }

        if (stmt.type === 'FunctionDeclaration') {
          const transformed = this.transformStatement(stmt);
          if (transformed) hoistedFunctions.push(transformed);
          continue;
        }

        const transformed = this.transformStatement(stmt);
        if (transformed) {
          if (Array.isArray(transformed)) {
            moduleStmts.push(...transformed);
          } else {
            moduleStmts.push(transformed);
          }
        }
      }
      module.statements.push(...hoistedFunctions, ...moduleStmts);
    }

    /**
     * Check if a condition is testing for Node.js main module entry point
     * Patterns: require.main === module, require.main == module
     */
    isNodeMainCheck(testNode) {
      if (!testNode) return false;

      // Direct comparison: require.main === module
      if (testNode.type === 'BinaryExpression' &&
          (testNode.operator === '===' || testNode.operator === '==')) {
        const { left, right } = testNode;
        // Check for require.main on either side
        const isRequireMain = (node) =>
          node.type === 'MemberExpression' &&
          node.object?.type === 'Identifier' && node.object?.name === 'require' &&
          node.property?.type === 'Identifier' && node.property?.name === 'main';
        const isModule = (node) =>
          node.type === 'Identifier' && node.name === 'module';

        if ((isRequireMain(left) && isModule(right)) ||
            (isRequireMain(right) && isModule(left))) {
          return true;
        }
      }

      // Logical AND: typeof require !== 'undefined' && require.main === module
      if (testNode.type === 'LogicalExpression' && testNode.operator === '&&') {
        // Check both sides for the require.main check
        return this.isNodeMainCheck(testNode.left) || this.isNodeMainCheck(testNode.right);
      }

      return false;
    }

    /**
     * Check if a condition is a CommonJS dependency-loading guard:
     * if (typeof require !== 'undefined') { require('./sibling.js'); ... }
     * These blocks lazily load sibling algorithm files for composition (e.g. CASCADE
     * chaining AES+Serpent). 'require' doesn't exist in Python and the guarded code
     * has no Python equivalent, so the whole if-statement is dropped.
     */
    isRequireGuard(testNode) {
      if (!testNode) return false;

      // Any of these being probed via `typeof X !== 'undefined'` indicates a
      // Node/AMD/CommonJS module-system guard (require(...) loading, or
      // module.exports / exports.X / define(...) wiring) - none of which has
      // a meaning in standalone transpiled Python, and the guarded code
      // (require calls, module.exports assignment) would NameError anyway.
      const MODULE_SYSTEM_GLOBALS = new Set([
        'require', 'module', 'exports', 'define',
        // UMD/browser environment-detection globals: guarded code is always
        // either module wiring or a dead fallback lookup, never core algorithm logic.
        'root', 'window', 'globalThis', 'self'
      ]);

      const isTypeofModuleGlobal = (n) => {
        if (!n) return false;
        // IL AST form (produced by the shared parser for `typeof x`)
        if (n.type === 'TypeOfExpression') {
          const arg = n.argument || n.value;
          return arg && arg.type === 'Identifier' && MODULE_SYSTEM_GLOBALS.has(arg.name);
        }
        // Raw JS AST form, in case it wasn't normalized
        if (n.type === 'UnaryExpression' && n.operator === 'typeof') {
          return n.argument && n.argument.type === 'Identifier' && MODULE_SYSTEM_GLOBALS.has(n.argument.name);
        }
        return false;
      };

      if (testNode.type === 'BinaryExpression' &&
          ['!==', '!=', '===', '=='].includes(testNode.operator)) {
        if (isTypeofModuleGlobal(testNode.left) || isTypeofModuleGlobal(testNode.right)) return true;
      }

      if (testNode.type === 'LogicalExpression') {
        return this.isRequireGuard(testNode.left) || this.isRequireGuard(testNode.right);
      }

      return false;
    }

    /**
     * Extract and transform content from IIFE wrapper
     * Handles multiple patterns:
     * - Simple: (function(global) { ... })(globalThis)
     * - UMD: (function(root, factory) { ... })((function(){...})(), function(deps) { ... })
     */
    transformIIFEContent(calleeNode, callExpr) {
      // First, try to find the factory function in UMD pattern
      // UMD pattern: the second argument is usually the factory function
      if (callExpr && callExpr.arguments && callExpr.arguments.length >= 2) {
        const factoryArg = callExpr.arguments[1];
        if (factoryArg.type === 'FunctionExpression' || factoryArg.type === 'ArrowFunctionExpression') {
          // Found UMD factory function - extract from its body
          return this.extractDeclarationsFromBody(factoryArg.body?.body || []);
        }
      }

      // Simple IIFE pattern: extract from callee's body
      if (!calleeNode.body || !calleeNode.body.body) return null;
      return this.extractDeclarationsFromBody(calleeNode.body.body);
    }

    /**
     * Extract declarations from a function body (IIFE unwrapping)
     * Only extracts class, function, and useful variable declarations.
     * Skips control flow (if/for/while), side effects, and Node.js-specific code.
     */
    extractDeclarationsFromBody(bodyStatements) {
      // Pre-pass: record every top-level let/const/var name *before*
      // transforming any function declarations below, regardless of source
      // order - JS closures can reference module-scope variables declared
      // later in the file (function declarations are effectively hoisted).
      for (const stmt of bodyStatements) {
        if (stmt.type === 'VariableDeclaration') {
          for (const d of stmt.declarations || []) {
            if (d.id && d.id.type === 'Identifier') {
              // See the matching comment in transformProgram()'s own pre-pass.
              const renamed = this.moduleConstRenames.has(d.id.name)
                ? this.moduleConstRenames.get(d.id.name)
                : toSnakeCase(d.id.name);
              this.moduleLevelVarNames.add(renamed);
            }
          }
        }
      }

      const declarations = [];

      for (const stmt of bodyStatements) {
        // Skip 'use strict' directive and other expression statements
        if (stmt.type === 'ExpressionStatement') {
          // Skip all expression statements in IIFE extraction
          // They are typically side effects (registration, logging, etc.)
          continue;
        }

        // Process class declarations
        if (stmt.type === 'ClassDeclaration') {
          const transformed = this.transformClassDeclaration(stmt);
          if (transformed) {
            // A class with an ES2022 `static { ... }` block comes back as
            // [pyClass, ...hoistedStatements] (see transformClassDeclaration) -
            // Python has no static-initializer-block equivalent, so its
            // statements are hoisted to run as plain module-level code
            // immediately after the class body, mirroring JS's own timing
            // (the block runs once, right after the class is defined).
            if (Array.isArray(transformed)) {
              declarations.push(...transformed);
            } else {
              declarations.push(transformed);
            }
          }
          continue;
        }

        // Process function declarations
        if (stmt.type === 'FunctionDeclaration') {
          const transformed = this.transformFunctionDeclaration(stmt);
          if (transformed) declarations.push(transformed);
          continue;
        }

        // Process variable declarations (const/let/var)
        if (stmt.type === 'VariableDeclaration') {
          const transformed = this.transformVariableDeclaration(stmt);
          if (transformed) {
            if (Array.isArray(transformed)) {
              declarations.push(...transformed);
            } else {
              declarations.push(transformed);
            }
          }
          continue;
        }

        // Most top-level if statements here really are feature-detection/
        // require() guards with nothing worth keeping - EXCEPT the
        // `if (global.AlgorithmFramework...) { AlgorithmFramework.
        // RegisterAlgorithm(X); }` / `if (typeof global.RegisterAlgorithm
        // === 'function') {...}` idiom, which is how every algorithm
        // registers itself. Files landing in this extraction path at all are
        // already the unusual case (see the comment on the ExpressionStatement/
        // CallExpression branch in transformProgram): the parser's own,
        // higher-fidelity unwrapModulePatterns() bails out and leaves the
        // whole IIFE wrapped whenever the file has more than one top-level
        // "main" statement after filtering - e.g. a trailing Node.js
        // `if (require.main === module) { ... }` self-test block, common in
        // this codebase's older files (xchacha20.js, ...). Blanket-skipping
        // every IfStatement here silently dropped the registration call
        // (among any other real code) for every such file - the algorithm
        // was fully defined but never reachable via
        // AlgorithmFramework.Find()/the registered-instance test harness.
        // Keep the same node-main-check/require-guard skip transformProgram's
        // own top-level loop already applies, and transform anything else
        // normally instead of discarding it.
        if (stmt.type === 'IfStatement') {
          if (this.isNodeMainCheck(stmt.test) || this.isRequireGuard(stmt.test)) continue;
          const transformed = this.transformStatement(stmt);
          if (transformed) {
            if (Array.isArray(transformed)) declarations.push(...transformed);
            else declarations.push(transformed);
          }
          continue;
        }

        // Skip return statements at module level
        if (stmt.type === 'ReturnStatement') continue;

        // Loops (for/while/do-while) here are almost always table-building
        // code, not disposable side effects - e.g. kuznyechik.js's
        // `(function() { for (let i = 0; i < 256; ++i) INV_SBOX[SBOX[i]] =
        // i; })();`, populating an inverse S-box from the forward one right
        // after both `const`s are declared. Unconditionally dropping these
        // (as this branch used to) leaves INV_SBOX all zeros - the algorithm
        // still "works" (no crash), it just silently decrypts wrong (same
        // class of bug the IfStatement branch above was already fixed for -
        // see its comment). Transform normally instead of discarding.
        if (stmt.type === 'ForStatement' || stmt.type === 'WhileStatement' || stmt.type === 'DoWhileStatement') {
          const transformed = this.transformStatement(stmt);
          if (transformed) {
            if (Array.isArray(transformed)) declarations.push(...transformed);
            else declarations.push(transformed);
          }
          continue;
        }

        // Skip all other statement types (try/etc.) in IIFE extraction
        // These are typically side-effect code not needed for the algorithm definition
      }

      // JS function declarations are fully hoisted above every other
      // top-level statement in their scope (unlike let/const, which are only
      // hoisted to a temporal-dead-zone) - a module-level
      // `const TABLE = buildTable();` can legally call a `function
      // buildTable() {...}` declared further down the same file. Python has
      // no such hoisting: module code runs strictly top-to-bottom, so
      // preserving JS source order here would raise NameError the first time
      // a constant is initialized from a not-yet-defined helper. Stably
      // move every function-declaration output to the front (functions
      // among themselves, and everything else, both keep their relative
      // order) to match JS's actual runtime visibility.
      if (declarations.length > 1) {
        const functions = declarations.filter(d => d instanceof PythonFunction);
        if (functions.length > 0 && functions.length < declarations.length) {
          const rest = declarations.filter(d => !(d instanceof PythonFunction));
          return [...functions, ...rest];
        }
      }

      return declarations.length > 0 ? declarations : null;
    }

    // ========================[ STATEMENTS ]========================

    transformStatement(node) {
      if (!node) return null;

      switch (node.type) {
        case 'ClassDeclaration':
          return this.transformClassDeclaration(node);
        case 'FunctionDeclaration':
          return this.transformFunctionDeclaration(node);
        case 'VariableDeclaration':
          return this.transformVariableDeclaration(node);
        case 'ExpressionStatement':
          return this.transformExpressionStatement(node);
        case 'ReturnStatement':
          return this.transformReturnStatement(node);
        case 'IfStatement':
          return this.transformIfStatement(node);
        case 'ForStatement':
          return this.transformForStatement(node);
        case 'ForOfStatement':
          return this.transformForOfStatement(node);
        case 'ForInStatement':
          return this.transformForInStatement(node);
        case 'WhileStatement':
          return this.transformWhileStatement(node);
        case 'DoWhileStatement':
          return this.transformDoWhileStatement(node);
        case 'SwitchStatement':
          return this.transformSwitchStatement(node);
        case 'BreakStatement':
          return new PythonBreak();
        case 'ContinueStatement':
          return new PythonContinue();
        case 'ThrowStatement':
          return this.transformThrowStatement(node);
        case 'TryStatement':
          return this.transformTryStatement(node);
        case 'BlockStatement':
          return this.transformBlockStatement(node);
        default:
          this.warnings.push(`Unsupported statement type: ${node.type}`);
          return null;
      }
    }

    transformClassDeclaration(node) {
      const className = toPascalCase(node.id.name);
      const pyClass = new PythonClass(className);

      // Track this class name so we can preserve it in identifier transformations
      this.definedClassNames.add(node.id.name);

      // Known framework base classes
      const FRAMEWORK_CLASSES = new Set([
        'BlockCipherAlgorithm', 'StreamCipherAlgorithm', 'HashFunctionAlgorithm',
        'AsymmetricAlgorithm', 'IBlockCipherInstance', 'IStreamCipherInstance',
        'IHashFunctionInstance', 'IAlgorithmInstance'
      ]);

      // Extract base classes
      if (node.superClass) {
        let baseName;
        // Handle both Identifier and MemberExpression (e.g., AlgorithmFramework.BlockCipherAlgorithm)
        if (node.superClass.type === 'MemberExpression') {
          // Use the property name (final class name)
          baseName = node.superClass.property.name || node.superClass.property.value;
        } else {
          baseName = node.superClass.name;
        }

        if (baseName) {
          // A `class X extends Y` where Y is neither a known framework base
          // nor a class actually declared in this file (e.g. acorn.js's
          // `const BaseAlgorithm = AeadAlgorithm || StreamCipherAlgorithm;
          // class ACORNAlgorithm extends BaseAlgorithm`) is a plain local
          // variable holding a class reference, not a PascalCase class name
          // to preserve verbatim. transformIdentifier() snake_cases that
          // same variable's declaration (`base_algorithm = ...`) since it
          // isn't in definedClassNames/FRAMEWORK_*_BASES either - so the
          // `extends` clause must apply the identical snake_case fold or it
          // references a name (`BaseAlgorithm`) nothing ever defines.
          const isKnownClass = FRAMEWORK_CLASSES.has(baseName) ||
            FRAMEWORK_ALGORITHM_BASES.includes(baseName) ||
            FRAMEWORK_INSTANCE_BASES.includes(baseName) ||
            this.definedClassNames.has(baseName);
          if (!isKnownClass)
            baseName = toSnakeCase(baseName);

          pyClass.baseClasses.push(baseName);

          // Track framework classes for stub generation
          if (FRAMEWORK_CLASSES.has(baseName))
            this.frameworkClasses.add(baseName);
        }
      }

      // Collect all method names to detect a field/method collision that is
      // an ARTIFACT OF SNAKE-CASE FOLDING - two distinct JS identifiers
      // (different case, e.g. this.result vs a base-class this.Result()
      // method) that only become identical once both are lowercased to
      // Python's naming convention. currentClassMethodNames maps each
      // folded snake_case name to the set of *raw* (pre-snake-case) JS
      // method names that fold to it, so transformThisPropertyAccess /
      // transformMemberExpression's dot-access branch can tell that case
      // apart from a bare `this.method` reference to the SAME literal JS
      // identifier as an existing method (e.g. haval.js building
      // `const fpFunctions = [this.fp3_1, this.fp3_2, ...]` to dispatch a
      // method as a first-class value) - the latter must resolve to the
      // real bound method (matching Python's own instance-shadows-method
      // descriptor semantics, identical to JS's prototype-chain shadowing),
      // not get diverted into a "_xxx_value" attribute nothing ever assigns.
      // NOTE: we exclude getters/setters because Python's @property handles
      // them correctly.
      const classMembers = node.body?.body || node.body || [];

      // Track fields this class's constructor initializes to `null` - see
      // the `_nullDefaultFields`-consuming branch in transformUnaryExpression
      // ('!' operator) for why: a required-field guard like kdf/bcrypt.js's
      // `if (!this.password) throw ...` (constructor: `this.password =
      // null;`, later `this.password = data;` in Feed()) means "was this
      // ever provided", which only `is None` captures correctly - Python's
      // own falsiness also rejects a legitimately-provided-but-EMPTY
      // array/string (e.g. the empty-password KAT vector, `data === []`),
      // even though JS's bare `!x` treats an empty array/string as truthy
      // (present). Restricted to the exact `this.field = null;` shape (no
      // conditionals/loops) so a field that can ALSO legitimately default to
      // `false`/`0` and rely on that falsy value to (correctly, matching JS)
      // trip the same guard is never included here.
      const prevNullDefaultFields = this._nullDefaultFields;
      this._nullDefaultFields = new Set();
      const ctorMember = classMembers.find(m => m.type === 'MethodDefinition' && m.kind === 'constructor');
      const ctorBody = ctorMember?.value?.body?.body || ctorMember?.value?.body || [];
      for (const stmt of ctorBody) {
        const expr = stmt?.type === 'ExpressionStatement' ? stmt.expression : null;
        if (expr?.type === 'AssignmentExpression' && expr.operator === '=' &&
            expr.right?.type === 'Literal' && expr.right.value === null) {
          const left = expr.left;
          const isThisField = (left?.type === 'ThisPropertyAccess' && !left.computed) ||
            (left?.type === 'MemberExpression' && !left.computed && left.object?.type === 'ThisExpression');
          if (isThisField) {
            const rawField = typeof left.property === 'string' ? left.property : (left.property?.name || left.property?.value);
            if (rawField) this._nullDefaultFields.add(toSnakeCaseProperty(rawField));
          }
        }
      }

      const prevMethodNames = this.currentClassMethodNames;
      this.currentClassMethodNames = new Map();
      for (const member of classMembers) {
        // Only add regular methods, not getters/setters/constructors
        if (member.type === 'MethodDefinition' &&
            member.kind !== 'constructor' &&
            member.kind !== 'get' &&
            member.kind !== 'set') {
          const rawName = member.key.name;
          const methodName = toSnakeCase(rawName);
          let rawNames = this.currentClassMethodNames.get(methodName);
          if (!rawNames) { rawNames = new Set(); this.currentClassMethodNames.set(methodName, rawNames); }
          rawNames.add(rawName);
        }
      }

      // Build a disambiguation map for the rarer case where MULTIPLE distinct
      // real methods collide onto the same snake_case name (not the field-vs-
      // method collision the `_xxx_value` rename above handles, but two
      // differently-invoked methods - e.g. shacal-2.js's message-schedule
      // `_sigma0`/`_sigma1` vs its round-function `_Sigma0`/`_Sigma1`, which
      // only clash because toSnakeCase() lowercases both to the same name).
      // Left unhandled, the second method definition silently overwrites the
      // first in the emitted Python class, and every call site that meant to
      // reach the first (however differently-cased in the original JS) ends
      // up calling the second instead - a self-consistent, silent semantic
      // bug (no crash, just wrong output). Keep the first-encountered raw
      // name's folded name as-is; give every other distinct raw name sharing
      // that bucket a numeric suffix so all remain independently callable.
      const prevMethodNameOverrides = this.currentMethodNameOverrides;
      this.currentMethodNameOverrides = new Map();
      for (const [methodName, rawNames] of this.currentClassMethodNames) {
        if (rawNames.size <= 1) continue;
        let n = 1;
        for (const rawName of rawNames) {
          if (n > 1) this.currentMethodNameOverrides.set(rawName, `${methodName}_v${n}`);
          n++;
        }
      }

      // Save current class context
      const prevClass = this.currentClass;
      this.currentClass = pyClass;

      // Process class body
      // Handle both standard ClassBody and unwrapped array of members
      const members = classMembers;

      // In Python, @property getter must come before @xxx.setter
      // First, identify setters without getters and create synthetic getters
      const getters = new Set(members
        .filter(m => m.type === 'MethodDefinition' && m.kind === 'get')
        .map(m => m.key?.name));
      const settersWithoutGetters = members
        .filter(m => m.type === 'MethodDefinition' && m.kind === 'set' && !getters.has(m.key?.name));

      // Create synthetic getter stubs for setter-only properties
      const syntheticGetters = settersWithoutGetters.map(setter => {
        const propName = setter.key?.name;
        const snakeName = toSnakeCase(propName);
        return {
          type: 'MethodDefinition',
          kind: 'get',
          key: { name: propName },
          static: setter.static,
          value: {
            params: [],
            body: {
              type: 'BlockStatement',
              body: [{
                type: 'ReturnStatement',
                argument: {
                  type: 'MemberExpression',
                  object: { type: 'ThisExpression' },
                  property: { type: 'Identifier', name: '_' + snakeName }
                }
              }]
            }
          },
          _synthetic: true // Mark as synthetic for potential debugging
        };
      });

      // Insert synthetic getters right before their corresponding setters
      // and sort to ensure all getters come before their setters
      const syntheticGetterMap = new Map(syntheticGetters.map(g => [g.key?.name, g]));
      const allMembers = [];
      for (const member of members) {
        // If this is a setter with a synthetic getter, insert the getter first
        if (member.type === 'MethodDefinition' && member.kind === 'set') {
          const syntheticGetter = syntheticGetterMap.get(member.key?.name);
          if (syntheticGetter) {
            allMembers.push(syntheticGetter);
            syntheticGetterMap.delete(member.key?.name); // Mark as inserted
          }
        }
        allMembers.push(member);
      }
      // Add any remaining synthetic getters (shouldn't happen but just in case)
      for (const getter of syntheticGetterMap.values()) {
        allMembers.push(getter);
      }

      // Sort to ensure getters come before setters for same property (for non-synthetic cases too)
      const sortedMembers = allMembers.sort((a, b) => {
        if (a.type !== 'MethodDefinition' || b.type !== 'MethodDefinition') return 0;
        // Only compare getter/setter ordering for the same property name
        if (a.key?.name === b.key?.name) {
          if (a.kind === 'get' && b.kind === 'set') return -1;
          if (a.kind === 'set' && b.kind === 'get') return 1;
        }
        return 0;
      });

      // Track emitted method names to detect duplicates (e.g., init() and Init() both -> init)
      const emittedMethodNames = new Set();

      if (sortedMembers && sortedMembers.length > 0) {
        for (const member of sortedMembers) {
          if (member.type === 'MethodDefinition') {
            let snakeName = toSnakeCase(member.key.name);
            // Use the disambiguated name (see currentMethodNameOverrides in
            // transformClassDeclaration) when this raw method name is one of
            // a genuine multi-method collision (e.g. shacal-2.js's `_sigma0`/
            // `_Sigma0`) - otherwise the generic "first definition wins" skip
            // below would drop the second method entirely instead of just
            // renaming it, silently making every caller of the dropped
            // method invoke the surviving one instead (wrong results, no
            // crash - the JS behaves as two distinct, correctly named
            // methods).
            if (this.currentMethodNameOverrides && this.currentMethodNameOverrides.has(member.key.name)) {
              snakeName = this.currentMethodNameOverrides.get(member.key.name);
            }

            // Skip methods that are just wrappers calling another method with same snake_case name
            // This handles patterns like Init() { this.init(); } which creates infinite recursion
            if (this._isWrapperCallingMethod(member, snakeName) && emittedMethodNames.has(snakeName)) {
              continue; // Skip this wrapper method
            }

            // Skip duplicate method definitions (different JS names that map to same snake_case)
            if (member.kind !== 'constructor' && member.kind !== 'get' && member.kind !== 'set') {
              if (emittedMethodNames.has(snakeName) && !this._isWrapperCallingMethod(member, snakeName)) {
                // If we already emitted this method and the new one isn't a simple wrapper,
                // we need to rename it to avoid overwriting
                continue; // Skip for now - first definition wins
              }
              emittedMethodNames.add(snakeName);
            }

            const method = this.transformMethodDefinition(member);
            if (method)
              pyClass.methods.push(method);
          } else if (member.type === 'PropertyDefinition' || member.type === 'FieldDefinition') {
            const assignment = this.transformPropertyDefinition(member);
            if (assignment)
              pyClass.classVariables.push(assignment);
          } else if (member.type === 'StaticBlock') {
            // ES2022 static block -> module-level code before class (Python doesn't have static blocks)
            const statements = this.transformStaticBlock(member);
            if (statements && statements.length > 0) {
              // Add as module-level statements (will be handled by caller)
              pyClass.staticInitStatements = statements;
            }
          }
        }
      }

      // Restore context
      this.currentClass = prevClass;
      this.currentClassMethodNames = prevMethodNames;
      this.currentMethodNameOverrides = prevMethodNameOverrides;
      this._nullDefaultFields = prevNullDefaultFields;

      this._autoDeclareInstanceFields(pyClass);

      // An ES2022 `static { ... }` block (see transformStaticBlock) has no
      // Python equivalent; its statements were stashed on
      // pyClass.staticInitStatements instead of being emitted inline.
      // Hoist them to run as module-level statements immediately after the
      // class body - matching JS's own timing (the block runs once, right
      // after the class is defined, before any instance is constructed) -
      // instead of silently discarding them, which left every value the
      // block was responsible for computing (e.g. ARIA's SB3/SB4 inverse
      // S-boxes, built from SB1/SB2 in a static block) as `None` forever.
      if (pyClass.staticInitStatements && pyClass.staticInitStatements.length > 0) {
        return [pyClass, ...pyClass.staticInitStatements];
      }

      return pyClass;
    }

    /**
     * JS objects tolerate reading `this.foo` before it's ever assigned
     * (yields undefined); Python raises AttributeError on a truly
     * never-assigned instance attribute. This is a very common pattern here:
     * a lazily-initialized backing field only ever touched inside a
     * property getter/setter pair (`get outputSize() { return
     * this._outputSize || 32 }` / `set outputSize(v) { this._outputSize = v
     * }`) with no `this._outputSize = null` in the constructor - fine in
     * JS, a hard crash in Python the moment the getter runs before the
     * setter ever has.
     *
     * Mirror JS's forgiving semantics generically: scan every method body in
     * the class for `self.<name>` reads/writes, and for any name that's
     * neither a method/property on this class, a class variable, nor
     * unconditionally assigned at __init__'s top level already, prepend a
     * `self.<name> = None` default at the very start of __init__ (before
     * even the super().__init__() call, so any real assignment later in the
     * constructor - conditional or not - simply overwrites the default in
     * program order).
     */
    _autoDeclareInstanceFields(pyClass) {
      const initMethod = pyClass.methods.find(m => m.name === '__init__');
      if (!initMethod || !initMethod.body || !Array.isArray(initMethod.body.statements)) return;

      const assignedInInit = new Set();
      for (const stmt of initMethod.body.statements) {
        if (stmt instanceof PythonAssignment && !stmt.isAugmented &&
            stmt.target instanceof PythonMemberAccess &&
            stmt.target.object instanceof PythonIdentifier && stmt.target.object.name === 'self') {
          assignedInInit.add(stmt.target.attribute);
        }
      }

      const knownNames = new Set(pyClass.methods.map(m => m.name));
      for (const cv of pyClass.classVariables) {
        if (cv instanceof PythonAssignment && cv.target instanceof PythonIdentifier)
          knownNames.add(cv.target.name);
      }

      const referenced = new Set();
      const seen = new Set();
      // isCallCallee: true when `node` is the callee of an enclosing call
      // (e.g. the `self.foo` in `self.foo(...)`). A bare method invocation
      // like that must NOT count as a "field reference" here - abstract
      // methods declared only in a subclass (called polymorphically from a
      // shared base class, e.g. `self._generate_key_schedule(key)` in a base
      // class's setter, overridden per-variant in each subclass) are not
      // "known" to the base class's own method list, so treating the call as
      // a field reference would prepend `self._generate_key_schedule = None`
      // to __init__ - an instance attribute that permanently shadows the
      // subclass's method of the same name for the lifetime of the instance.
      const visit = (node, isCallCallee) => {
        if (node == null || typeof node !== 'object' || seen.has(node)) return;
        if (Array.isArray(node)) { for (const n of node) visit(n, false); return; }
        seen.add(node);
        if (node instanceof PythonCall) {
          visit(node.func, true);
          for (const a of node.args || []) visit(a, false);
          for (const kw of node.kwargs || []) visit(kw && kw.value, false);
          return;
        }
        if (node instanceof PythonMemberAccess) {
          if (!isCallCallee && node.object instanceof PythonIdentifier && node.object.name === 'self' &&
              typeof node.attribute === 'string') {
            referenced.add(node.attribute);
          }
        }
        for (const key of Object.keys(node)) {
          if (key === 'parent') continue;
          visit(node[key], false);
        }
      };
      for (const m of pyClass.methods) visit(m.body, false);

      const missing = [...referenced].filter(name => !assignedInInit.has(name) && !knownNames.has(name));
      if (missing.length === 0) return;

      const defaults = missing.map(name =>
        new PythonAssignment(new PythonMemberAccess(new PythonIdentifier('self'), name), PythonLiteral.None())
      );
      initMethod.body.statements.unshift(...defaults);
    }

    transformMethodDefinition(node) {
      let methodName = toSnakeCase(node.key.name);
      // Disambiguate methods that only collide after case-folding (see the
      // currentMethodNameOverrides comment in transformClassDeclaration).
      if (this.currentMethodNameOverrides && this.currentMethodNameOverrides.has(node.key.name)) {
        methodName = this.currentMethodNameOverrides.get(node.key.name);
      }
      const isConstructor = node.kind === 'constructor';
      const isStatic = node.static;

      // Handle static getters specially - Python doesn't support @staticmethod + @property
      // For static getters that return a constant, convert to class variable
      if (isStatic && node.kind === 'get') {
        // Check if body is just: { return <literal>; }
        const body = node.value?.body;
        if (body?.type === 'BlockStatement' && body.body?.length === 1) {
          const stmt = body.body[0];
          if (stmt.type === 'ReturnStatement' && stmt.argument) {
            const arg = stmt.argument;
            // Check if it's a simple literal (number, string, boolean, null),
            // or a static table literal (e.g. groestl.js's
            // `static get SBOX() { return [0x63, 0x7c, ...]; }`, an AES
            // S-box read elsewhere as the bare attribute `GroestlHasher.SBOX`
            // with no call parens). Anything else (falling through to the
            // @staticmethod branch below) requires call syntax `.SBOX()` at
            // every use site, but callers keep the original JS's bare-getter
            // syntax verbatim - `sbox = GroestlHasher.SBOX` then binds `sbox`
            // to the *method object itself* ('function' object is not
            // subscriptable the instant it's indexed).
            if (arg.type === 'Literal' ||
                arg.type === 'NumericLiteral' ||
                arg.type === 'StringLiteral' ||
                arg.type === 'BooleanLiteral' ||
                arg.type === 'ArrayExpression' ||
                arg.type === 'ArrayLiteral') {
              // Convert to class variable
              const varValue = this.transformExpression(arg);
              const assignment = new PythonAssignment(
                new PythonIdentifier(methodName),
                varValue
              );
              assignment.isClassVariable = true;
              return assignment;
            }
          }
        }
        // For complex static getters, use a regular method without @property
        // User will need to call it as ClassName.method_name() instead of ClassName.method_name
      }

      const pyFunc = new PythonFunction(
        isConstructor ? '__init__' : methodName,
        [],
        null
      );

      pyFunc.isMethod = true;
      pyFunc.isStaticMethod = isStatic;

      // Add decorators
      if (isStatic) {
        pyFunc.decorators.push('staticmethod');
      }
      // Only add @property for non-static getters (static getters handled above)
      if (node.kind === 'get' && !isStatic) {
        pyFunc.decorators.push('property');
        pyFunc.isProperty = true;
      }
      if (node.kind === 'set') {
        pyFunc.decorators.push(`${methodName}.setter`);
      }

      // Parameters (add 'self' for instance methods)
      if (!isStatic) {
        pyFunc.parameters.push(new PythonParameter('self'));
      }

      // Push scope
      this.pushScope();

      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          const pyParam = this.transformParameter(param);
          pyFunc.parameters.push(pyParam);

          // Register parameter type
          if (pyParam.type) {
            this.registerVariableType(param.name, pyParam.type);
          }
        }
      }
      this._ensureVarArgsTolerance(pyFunc);

      // Return type (only if addTypeHints is enabled)
      if (this.addTypeHints && node.value && node.value.returnType) {
        pyFunc.returnType = this.mapType(node.value.returnType);
      }

      // Set current method and property context
      const prevMethod = this.currentMethod;
      const prevPropertyName = this.currentPropertyName;
      const prevPropertyNameRaw = this.currentPropertyNameRaw;
      const prevFunctionNode = this._currentFunctionNode;
      this.currentMethod = pyFunc;
      this._currentFunctionNode = node.value || node;
      // _rawBitwiseVarNames (see its constructor doc comment) is keyed only
      // by raw variable NAME, with no scope information - a short, common
      // name (state/t/x/z/...) tracked as "holds an unnormalized raw
      // bitwise result" in ONE method must not leak into an unrelated
      // same-named local in a DIFFERENT method that never touched a raw
      // bitwise op at all (e.g. random/xorwow.js regressed this way after
      // mersenne-twister.js's fix was added: a same-named local in a
      // different method got wrongly reinterpreted as JS-signed before a
      // float64 multiply, corrupting an otherwise-exact computation).
      // Resetting per method scopes tracking to "this method's own
      // declarations", matching how the bug this backs actually manifests
      // (a variable factored out within the SAME function body).
      const prevRawBitwiseVarNames = this._rawBitwiseVarNames;
      this._rawBitwiseVarNames = new Set();

      // Track property name if this is a getter or setter
      // This allows us to detect backing field access patterns like:
      // get outputSize() { return this.OutputSize; }  -> should use self._output_size
      // currentPropertyNameRaw keeps the un-snake-cased JS identifier
      // (e.g. "OutputSize") alongside the snake_case one, so the
      // backing-field rewrite (see transformThisPropertyAccess /
      // transformMemberExpression) can tell "different JS spelling that
      // happens to collide after snake_casing" (rename to a backing field)
      // apart from "the exact same JS identifier, deliberately reassigned to
      // itself inside its own setter to re-dispatch on a different runtime
      // type" (e.g. Rainbow's `set key(keyData) { ...; this.key = keyString;
      // ... }`, re-parsing a byte array as a string) - the latter must stay
      // a genuine recursive property re-invocation, matching JS semantics,
      // not get diverted into a backing field nothing else ever reads.
      if (node.kind === 'get' || node.kind === 'set') {
        this.currentPropertyName = methodName;
        this.currentPropertyNameRaw = node.key.name;
      }

      // Body
      this._enclosingLocalsStack.push(new Set());
      const prevTranscendentalArgNames = this._transcendentalArgNames;
      this._transcendentalArgNames = new Set();
      const prevUndefinedCheckedVarNames = this._undefinedCheckedVarNames;
      this._undefinedCheckedVarNames = new Set();
      if (node.value && node.value.body) {
        this._collectTranscendentalArgNames(node.value.body, this._transcendentalArgNames);
        this._collectUndefinedCheckedNames(node.value.body, this._undefinedCheckedVarNames);
        pyFunc.body = this.transformBlockStatement(node.value.body);
      }
      this._transcendentalArgNames = prevTranscendentalArgNames;
      this._undefinedCheckedVarNames = prevUndefinedCheckedVarNames;
      this._addNonlocalDeclarationsIfNeeded(pyFunc);
      this._enclosingLocalsStack.pop();

      // Restore context
      this.currentMethod = prevMethod;
      this._currentFunctionNode = prevFunctionNode;
      this._rawBitwiseVarNames = prevRawBitwiseVarNames;
      this.currentPropertyName = prevPropertyName;
      this.currentPropertyNameRaw = prevPropertyNameRaw;
      this.popScope();

      return pyFunc;
    }

    /**
     * Recursively collect the names of every simple-identifier assignment
     * target within a (already-transformed) Python statement/block, without
     * descending into nested function/class definitions (those are separate
     * scopes). Used to detect closures over module-level variables so a
     * `global x` declaration can be inserted - see transformFunctionDeclaration.
     */
    _collectAssignedNames(node, out) {
      if (!node) return;
      if (Array.isArray(node)) {
        for (const n of node) this._collectAssignedNames(n, out);
        return;
      }
      switch (node.nodeType) {
        case 'Block':
          for (const s of node.statements) this._collectAssignedNames(s, out);
          return;
        case 'ExpressionStatement':
          // `x = value;` as a statement wraps the Assignment inside here
          // rather than emitting the Assignment node directly.
          this._collectAssignedNames(node.expression, out);
          return;
        case 'Assignment': {
          // A `const`/`let`/`var` declaration (isDeclaration, set by
          // transformVariableDeclaration) always introduces a fresh binding
          // local to this function in JS, even when it shares a name with an
          // outer/module-level variable - it must never be treated as
          // needing `global` (that would make the local shadow permanently
          // clobber the outer variable instead). Only a bare reassignment
          // with no declaration keyword can actually mean "write through to
          // the outer scope" - see the isDeclaration comment in
          // transformVariableDeclaration for the full reasoning.
          if (node.isDeclaration) return;
          const collectTarget = (t) => {
            if (!t) return;
            if (t.nodeType === 'Identifier') out.add(t.name);
            else if (t.nodeType === 'Tuple' || t.nodeType === 'List') {
              for (const el of (t.elements || [])) collectTarget(el);
            }
          };
          collectTarget(node.target);
          return;
        }
        case 'If':
          this._collectAssignedNames(node.thenBranch, out);
          for (const b of (node.elifBranches || [])) this._collectAssignedNames(b.body, out);
          this._collectAssignedNames(node.elseBranch, out);
          return;
        case 'For':
        case 'While':
          this._collectAssignedNames(node.body, out);
          return;
        case 'TryExcept':
          this._collectAssignedNames(node.tryBlock, out);
          for (const c of (node.exceptClauses || [])) this._collectAssignedNames(c.body, out);
          this._collectAssignedNames(node.finallyBlock, out);
          return;
        default:
          // Function/Class definitions and everything else: not a shared scope, stop.
          return;
      }
    }

    /**
     * If a function body reassigns a variable that belongs to the enclosing
     * module scope (tracked in moduleLevelVarNames), prepend `global x, y`
     * so Python doesn't treat the name as local-for-the-whole-function (which
     * raises UnboundLocalError on any read preceding the write - a very
     * common pattern for JS closures implementing lazy-init caches, e.g.
     * `let ready = false; function init() { if (ready) return; ...; ready = true; }`).
     */
    _addGlobalDeclarationsIfNeeded(pyFunc) {
      if (!pyFunc || !pyFunc.body || this.moduleLevelVarNames.size === 0) return;
      const assigned = new Set();
      this._collectAssignedNames(pyFunc.body, assigned);
      const needsGlobal = [...assigned].filter(name => this.moduleLevelVarNames.has(name));
      if (needsGlobal.length === 0) return;
      // Python forbids combining `global x` with a type-annotated assignment
      // to x in the same function ("SyntaxError: annotated name 'x' can't be
      // global") - strip any such annotations before adding the declaration.
      const globalNames = new Set(needsGlobal);
      this._stripTypeAnnotationsFor(pyFunc.body, globalNames);
      pyFunc.body.statements.unshift({ nodeType: 'RawCode', code: `global ${needsGlobal.join(', ')}` });
    }

    /**
     * Sibling of _addGlobalDeclarationsIfNeeded, for names owned by an
     * ENCLOSING FUNCTION scope rather than the module (see the
     * _enclosingLocalsStack comment in the constructor for the motivating
     * balloon.js closure-sharing pattern). Must run while the function's own
     * just-populated locals frame is still on top of the stack (so its own
     * declarations are correctly excluded as "shadowing", not "needs
     * nonlocal") but before it's popped.
     */
    _addNonlocalDeclarationsIfNeeded(pyFunc) {
      if (!pyFunc || !pyFunc.body) return;
      const stack = this._enclosingLocalsStack;
      if (!stack || stack.length < 2) return; // no ancestor function scope to bind to
      const ownFrame = stack[stack.length - 1];
      const assigned = new Set();
      this._collectAssignedNames(pyFunc.body, assigned);
      const needsNonlocal = [];
      for (const name of assigned) {
        if (ownFrame.has(name) || this.moduleLevelVarNames.has(name)) continue;
        for (let i = stack.length - 2; i >= 0; i--) {
          if (stack[i].has(name)) { needsNonlocal.push(name); break; }
        }
      }
      if (needsNonlocal.length === 0) return;
      const nonlocalNames = new Set(needsNonlocal);
      this._stripTypeAnnotationsFor(pyFunc.body, nonlocalNames);
      pyFunc.body.statements.unshift({ nodeType: 'RawCode', code: `nonlocal ${needsNonlocal.join(', ')}` });
    }

    /**
     * Companion to _collectAssignedNames: clear the `.type` annotation on any
     * Assignment whose target is one of `names`, using the identical
     * (block-scoped, function/class-boundary-respecting) traversal.
     */
    _stripTypeAnnotationsFor(node, names) {
      if (!node) return;
      if (Array.isArray(node)) {
        for (const n of node) this._stripTypeAnnotationsFor(n, names);
        return;
      }
      switch (node.nodeType) {
        case 'Block':
          for (const s of node.statements) this._stripTypeAnnotationsFor(s, names);
          return;
        case 'ExpressionStatement':
          this._stripTypeAnnotationsFor(node.expression, names);
          return;
        case 'Assignment':
          if (node.target && node.target.nodeType === 'Identifier' && names.has(node.target.name)) {
            node.type = null;
          }
          return;
        case 'If':
          this._stripTypeAnnotationsFor(node.thenBranch, names);
          for (const b of (node.elifBranches || [])) this._stripTypeAnnotationsFor(b.body, names);
          this._stripTypeAnnotationsFor(node.elseBranch, names);
          return;
        case 'For':
        case 'While':
          this._stripTypeAnnotationsFor(node.body, names);
          return;
        case 'TryExcept':
          this._stripTypeAnnotationsFor(node.tryBlock, names);
          for (const c of (node.exceptClauses || [])) this._stripTypeAnnotationsFor(c.body, names);
          this._stripTypeAnnotationsFor(node.finallyBlock, names);
          return;
        default:
          return;
      }
    }

    transformFunctionDeclaration(node) {
      const funcName = toSnakeCase(node.id.name);
      const pyFunc = new PythonFunction(funcName, [], null);

      // Push scope
      this.pushScope();

      // Parameters
      if (node.params) {
        for (const param of node.params) {
          const pyParam = this.transformParameter(param);
          pyFunc.parameters.push(pyParam);

          // Register parameter type
          if (pyParam.type) {
            this.registerVariableType(param.name, pyParam.type);
          }
        }
      }
      this._ensureVarArgsTolerance(pyFunc);

      // Return type (only if addTypeHints is enabled)
      if (this.addTypeHints && node.returnType) {
        pyFunc.returnType = this.mapType(node.returnType);
      }

      // Set current method
      const prevMethod = this.currentMethod;
      this.currentMethod = pyFunc;
      // Also track the raw function node itself (see _isArrayLikeParam's
      // doc comment) - transformMethodDefinition does the same for class
      // methods; a plain top-level `function foo(a, b) {...}` (e.g.
      // aead/paef-forkskinny.js's `forkskinny_128_256_encrypt`, which fills
      // an optional `output_left`/`output_right` "out" parameter via direct
      // index assignment) needs the identical array-like-parameter
      // detection an instance method gets, or `if (output_left &&
      // output_right)` keeps using Python's plain (wrong-for-JS-arrays)
      // truthiness instead.
      const prevFunctionNode = this._currentFunctionNode;
      this._currentFunctionNode = node;

      // Body
      this._enclosingLocalsStack.push(new Set());
      if (node.body) {
        pyFunc.body = this.transformBlockStatement(node.body);
      }
      this._addNonlocalDeclarationsIfNeeded(pyFunc);
      this._enclosingLocalsStack.pop();

      // Restore context
      this.currentMethod = prevMethod;
      this._currentFunctionNode = prevFunctionNode;
      this.popScope();

      this._addGlobalDeclarationsIfNeeded(pyFunc);

      return pyFunc;
    }

    transformParameter(node) {
      // Handle different parameter node structures:
      // - Identifier: { name: 'param' }
      // - AssignmentPattern: { left: { name: 'param' }, right: defaultValue }
      // - RestElement: { argument: { name: 'param' } }
      let rawName;
      let defaultValueNode = null;
      let typeAnnotation = null;

      if (node.type === 'AssignmentPattern' ||
          // TypeAwareJSASTParser's arrow-function parameter list keeps
          // default-valued params in their raw parsed shape - an
          // AssignmentExpression (`.left`/`.right`), not the ESTree
          // AssignmentPattern a normal `function f(x = 0)` declaration's
          // parameter gets - `(code = 0) => ...` reaches here as
          // `{type: 'AssignmentExpression', left: {name: 'code'}, right:
          // {value: 0}}`. Without this, `rawName`/`defaultValueNode` stayed
          // unset (neither branch below matches an AssignmentExpression),
          // falling to the generic `param_N` placeholder name below - which
          // then NameErrors every reference to the real parameter name
          // (`code`, `length`, ...) inside the function body.
          (node.type === 'AssignmentExpression' && node.left)) {
        // Parameter with default value: (param = default)
        rawName = node.left?.name || node.left?.id?.name;
        defaultValueNode = node.right;
        typeAnnotation = node.left?.typeAnnotation || node.typeAnnotation;
      } else if (node.type === 'RestElement' || node.type === 'RestParameter') {
        // Rest parameter: (...params). Raw ESTree parses to 'RestElement';
        // type-aware-transpiler.js's _transformRestElement() normalizes it
        // to the IL node type 'RestParameter' ({name, argument, ...}) - by
        // the time a FunctionDeclaration/method's params reach here they're
        // already IL, so 'RestParameter' is the common case, but arrow
        // function parameter lists sometimes keep the raw shape (see the
        // AssignmentExpression comment above), so accept both spellings.
        rawName = node.name || node.argument?.name || node.argument?.id?.name;
        typeAnnotation = node.argument?.typeAnnotation || node.typeAnnotation;
      } else {
        // Simple Identifier parameter
        rawName = node.name || node.id?.name;
        defaultValueNode = node.defaultValue;
        typeAnnotation = node.typeAnnotation;
      }

      // Fallback to unique param name if still undefined
      if (!rawName) {
        rawName = `param_${this._paramCounter || 0}`;
        this._paramCounter = (this._paramCounter || 0) + 1;
      }

      const paramName = toSnakeCase(rawName);
      let type = null;
      let defaultValue = null;

      // Type annotation (only if addTypeHints is enabled)
      if (this.addTypeHints && typeAnnotation) {
        type = this.mapType(typeAnnotation);
      }

      const isRest = node.type === 'RestElement' || node.type === 'RestParameter';

      // Default value
      if (defaultValueNode) {
        defaultValue = this.transformExpression(defaultValueNode);
      } else if (!isRest) {
        // JS never enforces call-site arity: `function f(x) {}` can be
        // called as `f()`, silently binding `x` to `undefined` - a common
        // idiom then supplies the real default inside the body
        // (`x = x || DEFAULT;` / `if (x === undefined) x = DEFAULT;`).
        // Python has no such leniency: an undefaulted positional parameter
        // makes the call a hard TypeError. Defaulting every plain parameter
        // to None mirrors JS's actual permissiveness (None already stands
        // in for `undefined` throughout this transpiler's output) instead
        // of crashing every call site that (validly, in JS) omits a
        // trailing argument the callee defaults internally.
        defaultValue = PythonLiteral.None();
      }

      const pyParam = new PythonParameter(paramName, type, defaultValue);
      // A JS `...rest` parameter collects every remaining positional
      // argument into a real array (rest.length, rest[i], etc. all need to
      // work) - a Python `*name` catch-all is the direct equivalent (bound
      // as a tuple). Emitting it as an ordinary single-value parameter (as
      // before this fix) silently dropped every argument past the first
      // and, since defaultValue above is null here (isRest is true so no
      // more than the fallback param name), made any call with 2+ trailing
      // args a hard positional-argument-count TypeError instead of JS's
      // permissive collection.
      if (isRest) {
        pyParam.isRest = true;
        pyParam.defaultValue = null;
      }
      return pyParam;
    }

    /**
     * Append a synthetic `*_js_extra_args` catch-all to a function/method's
     * parameter list, unless it already ends in a real rest parameter.
     *
     * JS never enforces call-site arity in either direction: a function
     * declared `f(a, b)` can legally be called `f(a, b, c)`, silently
     * discarding the extra argument (transformParameter's default-None
     * handling above already covers the opposite, too-FEW-args case).
     * Python raises `TypeError: f() takes N positional arguments but M
     * were given` the instant a call site supplies more arguments than the
     * callee declares - a real, observed transpiler defect (e.g. safer.js's
     * `this._expandKey(keyBytes, this.isStrengthened)` calling a
     * single-parameter `_expandKey(keyBytes)`, which JS ignores and Python
     * hard-crashes on before a single test vector runs). Silently
     * collecting the extras into an unused catch-all is the direct
     * equivalent of JS dropping them, and is a no-op for the overwhelming
     * majority of calls that pass the exact declared argument count.
     */
    _ensureVarArgsTolerance(pyFunc) {
      const params = pyFunc.parameters;
      if (params.length > 0 && params[params.length - 1].isRest) return;
      const catchAll = new PythonParameter('_js_extra_args');
      catchAll.isRest = true;
      params.push(catchAll);
    }

    transformPropertyDefinition(node) {
      const propName = toSnakeCase(node.key.name);
      const value = node.value ? this.transformExpression(node.value) : PythonLiteral.None();

      const assignment = new PythonAssignment(
        new PythonIdentifier(propName),
        value
      );

      // Type annotation (only if addTypeHints is enabled)
      if (this.addTypeHints && node.typeAnnotation) {
        assignment.type = this.mapType(node.typeAnnotation);
      }

      return assignment;
    }

    transformStaticBlock(node) {
      // ES2022 static block -> Python module-level statements
      // Python doesn't have static class blocks, so transform to statements
      // node.body is a BlockStatement, so access its body property
      const statements = node.body?.body || node.body || [];
      if (Array.isArray(statements)) {
        return statements.map(stmt => this.transformStatement(stmt)).filter(s => s);
      }
      return [];
    }

    transformClassExpression(node) {
      // ClassExpression -> Python class definition
      const className = node.id?.name || 'AnonymousClass';
      const classDecl = new PythonClass(className);

      if (node.superClass)
        classDecl.baseClasses = [this.transformExpression(node.superClass)];

      if (node.body?.body) {
        const members = node.body.body;

        // In Python, @property getter must come before @xxx.setter
        // First, identify setters without getters and create synthetic getters
        const getters = new Set(members
          .filter(m => m.type === 'MethodDefinition' && m.kind === 'get')
          .map(m => m.key?.name));
        const settersWithoutGetters = members
          .filter(m => m.type === 'MethodDefinition' && m.kind === 'set' && !getters.has(m.key?.name));

        // Create synthetic getter stubs for setter-only properties
        const syntheticGetters = settersWithoutGetters.map(setter => {
          const propName = setter.key?.name;
          const snakeName = toSnakeCase(propName);
          return {
            type: 'MethodDefinition',
            kind: 'get',
            key: { name: propName },
            static: setter.static,
            value: {
              params: [],
              body: {
                type: 'BlockStatement',
                body: [{
                  type: 'ReturnStatement',
                  argument: {
                    type: 'MemberExpression',
                    object: { type: 'ThisExpression' },
                    property: { type: 'Identifier', name: '_' + snakeName }
                  }
                }]
              }
            },
            _synthetic: true
          };
        });

        // Insert synthetic getters right before their corresponding setters
        const syntheticGetterMap = new Map(syntheticGetters.map(g => [g.key?.name, g]));
        const allMembers = [];
        for (const member of members) {
          if (member.type === 'MethodDefinition' && member.kind === 'set') {
            const syntheticGetter = syntheticGetterMap.get(member.key?.name);
            if (syntheticGetter) {
              allMembers.push(syntheticGetter);
              syntheticGetterMap.delete(member.key?.name);
            }
          }
          allMembers.push(member);
        }
        for (const getter of syntheticGetterMap.values()) {
          allMembers.push(getter);
        }

        // Sort to ensure getters come before setters for same property
        const sortedMembers = allMembers.sort((a, b) => {
          if (a.type !== 'MethodDefinition' || b.type !== 'MethodDefinition') return 0;
          if (a.key?.name === b.key?.name) {
            if (a.kind === 'get' && b.kind === 'set') return -1;
            if (a.kind === 'set' && b.kind === 'get') return 1;
          }
          return 0;
        });

        for (const member of sortedMembers) {
          if (member.type === 'MethodDefinition') {
            const method = this.transformMethodDefinition(member);
            if (method)
              classDecl.methods.push(method);
          } else if (member.type === 'PropertyDefinition' || member.type === 'FieldDefinition') {
            const prop = this.transformPropertyDefinition(member);
            if (prop)
              classDecl.classVariables.push(prop);
          }
        }
      }

      return classDecl;
    }

    transformYieldExpression(node) {
      // Python has yield for generators - return argument for now
      const argument = node.argument ? this.transformExpression(node.argument) : PythonLiteral.None();
      return argument;
    }

    /**
     * True if a raw JS AST expression node definitely evaluates to the
     * OpCodes object: the bare `OpCodes` identifier, `global.OpCodes` /
     * `globalThis.OpCodes`, or a ternary/logical-OR between those (the
     * `typeof OpCodes !== 'undefined' ? OpCodes : global.OpCodes` guard
     * pattern used across several algorithm files).
     */
    _referencesOpCodes(node) {
      if (!node) return false;
      if (node.type === 'Identifier' && node.name === 'OpCodes') return true;
      if (node.type === 'MemberExpression' &&
          node.object.type === 'Identifier' &&
          (node.object.name === 'global' || node.object.name === 'globalThis') &&
          (node.property.name || node.property.value) === 'OpCodes') {
        return true;
      }
      if (node.type === 'ConditionalExpression') {
        return this._referencesOpCodes(node.consequent) || this._referencesOpCodes(node.alternate);
      }
      if (node.type === 'LogicalExpression') {
        return this._referencesOpCodes(node.left) || this._referencesOpCodes(node.right);
      }
      return false;
    }

    transformVariableDeclaration(node) {
      const assignments = [];

      // Preserve whatever the enclosing context already had queued in the
      // shared pendingPreStatements/pendingPostStatements scratch space
      // before this declaration ran. Each loop iteration below treats
      // this.pendingPreStatements/pendingPostStatements as its OWN private
      // scratch and unconditionally clears it - fine when this function is
      // reached directly from a top-level statement (nothing was pending
      // yet), but NOT when it's reached nested inside an enclosing hoist
      // that hasn't flushed its own pending item yet: e.g. a test-vector
      // array literal `this.tests = [{ seed: (function(){ const a = ...;
      // return a; })() }, { seed: (function(){ const b = ...; return b;
      // })() }]` - transformCallbackExpr hoists the FIRST IIFE's helper
      // function into this.pendingPreStatements, but transformBlockStatement
      // then walks straight into the SECOND IIFE's body (a `const b = ...`
      // VariableDeclaration) to build its own helper, and reaching this
      // function's per-declarator reset used to wipe out the first helper's
      // still-unflushed definition before it was ever emitted - silently
      // dropping it and leaving a NameError at its call site (see
      // random/isaac.js's `_cb_1`/`_cb_2` test-seed generators, only the
      // second of which ever got defined).
      const outerPendingPre = this.pendingPreStatements;
      const outerPendingPost = this.pendingPostStatements;

      for (const declarator of node.declarations) {
        // Skip ObjectPattern destructuring (e.g., const { RegisterAlgorithm } = AlgorithmFramework)
        if (declarator.id.type === 'ObjectPattern')
          continue;

        // Handle array destructuring: const [a, b, c] = arr;
        // Python supports tuple unpacking natively: a, b, c = arr
        if (declarator.id.type === 'ArrayPattern') {
          const sourceExpr = declarator.init ? this.transformExpression(declarator.init) : null;
          if (sourceExpr && declarator.id.elements.length > 0) {
            // Build tuple of variable names
            const varNames = [];
            for (const elem of declarator.id.elements) {
              if (elem) {
                varNames.push(new PythonIdentifier(toSnakeCase(elem.name)));
              } else {
                varNames.push(new PythonIdentifier('_')); // Placeholder for holes
              }
            }

            // Create tuple unpacking: (a, b, c) = arr
            const tupleTarget = new PythonTuple(varNames);
            const tupleAssignment = new PythonAssignment(tupleTarget, sourceExpr);
            // See the isDeclaration comment below (main scalar-declarator
            // path) - a `const [a, b] = ...`/`let [a, b] = ...` destructure
            // is exactly as much a fresh local binding as a scalar `const`,
            // so it must be exempted from the "needs global" scan the same way.
            tupleAssignment.isDeclaration = true;
            assignments.push(tupleAssignment);
          }
          continue;
        }

        // Constant-table names (K, H, IV, SBOX, ...) get a per-file-unique
        // name here instead of the plain snake_case fold - see the
        // moduleConstRenames comment in transformProgram(). A same-block
        // sibling declarator whose raw name collides with an EARLIER one
        // only after snake-casing (e.g. `wS` vs `w_S` - see
        // transformBlockStatement's _collectLocalNameCollisions doc comment)
        // was already assigned a disambiguated name in _localNameOverrides,
        // keyed by this SAME raw JS name - reuse it here for the declaration
        // site too, or every later read would resolve to the renamed
        // variable while the declaration itself still bound the plain
        // (collided) one.
        const localOverride = this._localNameOverrides && this._localNameOverrides.get(declarator.id.name);
        const varName = this.moduleConstRenames.has(declarator.id.name)
          ? this.moduleConstRenames.get(declarator.id.name)
          : (localOverride || toSnakeCase(declarator.id.name));

        // Record this declaration into the innermost currently-open function
        // scope's local-names set (see _enclosingLocalsStack) BEFORE
        // transforming the rest of this function's body, so any nested
        // closure declared later in the same body (e.g. a hoisted
        // object-literal method reassigning this same name) can be detected
        // as needing `nonlocal` - see _addNonlocalDeclarationsIfNeeded.
        if (this._enclosingLocalsStack.length > 0) {
          this._enclosingLocalsStack[this._enclosingLocalsStack.length - 1].add(varName);
        }

        // Track local aliases of the OpCodes object (see opCodesAliases above)
        // so calls through the alias still resolve to real OpCodes methods.
        if (declarator.init && this._referencesOpCodes(declarator.init)) {
          this.opCodesAliases.add(varName);
        }

        // Track `const X = new Uint32Array(...)` declarations by their
        // ORIGINAL (pre-snake_case) JS name - see the matching lookup in
        // transformTypedArrayCreation()'s `new Uint8Array(X.buffer)` byte-
        // view handling, which needs to tell "X holds 32-bit words, so
        // reinterpreting its buffer as bytes must decompose each word into
        // 4 little-endian bytes" apart from "X already holds byte values
        // (e.g. a DataView-backed buffer), so its buffer IS the byte view".
        if (declarator.init && declarator.init.type === 'TypedArrayCreation' &&
            declarator.init.arrayType === 'Uint32Array') {
          this.uint32ArrayVarNames.add(declarator.id.name);
        }

        // Track `const/let X = a ^ b` (or a bare `|`) declarations by their
        // ORIGINAL JS name - see _rawBitwiseVarNames' doc comment (in the
        // constructor) and _lowerAsFloat64Chain's matching lookup for the
        // full reasoning. A later re-declaration/shadowing with a
        // non-bitwise initializer removes the name again so a stale entry
        // can't misfire on an unrelated same-named variable.
        //
        // Deliberately excludes `&` (unlike ^/|): `ilNodeType ===
        // 'InlinedOpCode'` turned out NOT to reliably flag every inlined
        // OpCodes call - e.g. random/xorwow.js's `const s0 =
        // OpCodes.Xor32(low, 0xAAD26B49)` inlines to a raw `^` node
        // *wrapped in* `& 0xFFFFFFFF` with the OUTER node's ilNodeType left
        // as plain 'BinaryExpression', not 'InlinedOpCode' (regressed
        // ~20 files - every one shared this "XorN/AndN/OrN result
        // immediately re-masked with a literal" shape - before this
        // exclusion was added). An `&`-with-a-literal-mask is exactly
        // JS Xor32/AndN/OrN's own real normalization technique (masking
        // ensures a definite, already-non-negative-in-Python-terms
        // magnitude) - the mersenne-twister.js bug this backs only
        // actually needs the correction for a BARE, un-remasked `^`/`|`
        // result (JS's true int32-signed value, no follow-up mask ever
        // applied), which never reaches this branch with operator `&`.
        if (declarator.init && declarator.init.type === 'BinaryExpression' &&
            ['^', '|'].includes(declarator.init.operator) &&
            declarator.init.ilNodeType !== 'InlinedOpCode') {
          this._rawBitwiseVarNames.add(declarator.id.name);
        } else if (declarator.init) {
          this._rawBitwiseVarNames.delete(declarator.id.name);
        }

        // Check if this is an arrow/function expression with a block body
        // These need to be converted to actual function definitions, not lambdas.
        // 'ArrowFunction' (no "Expression" suffix) is TypeAwareJSASTParser's own
        // IL-normalized node type for arrow functions (see
        // _transformFunctionExpression in type-aware-transpiler.js) - the raw
        // parser used by the Python transpile path emits this instead of the
        // ESTree 'ArrowFunctionExpression' name; without recognizing it, a
        // block-bodied arrow like `const traverse = (node, code = 0, length =
        // 0) => { if (...) traverse(...); }` fell through to the generic
        // expression-transform's `case 'ArrowFunction'` (see
        // transformExpression below), which can only represent a single
        // trailing `return <expr>` and silently collapses everything else -
        // recursive calls, side effects, no return - to `lambda ...: None`,
        // discarding the entire function body without even erroring.
        if (declarator.init &&
            (declarator.init.type === 'ArrowFunctionExpression' ||
             declarator.init.type === 'ArrowFunction' ||
             declarator.init.type === 'FunctionExpression') &&
            declarator.init.body.type === 'BlockStatement') {
          // Convert to function definition: const foo = x => { ... } becomes def foo(x): ...
          const funcDef = this.transformArrowToFunction(varName, declarator.init);
          assignments.push(funcDef);
          continue;
        }

        // Check if this is an IIFE (immediately invoked function expression)
        let value;
        this.pendingPreStatements = [];
        this.pendingPostStatements = [];
        if (declarator.ilNodeType === 'DestructuredProperty' && declarator.init &&
            declarator.init.type === 'MemberExpression' && !declarator.init.computed) {
          // `const {code, length} = codes[symbol]` (compression/deflate.js's
          // HuffmanTree.buildFromLengths - a plain `{code, length}` object
          // literal, NOT a real JS array/string) - the shared IL parser
          // flattens this into one 'DestructureTemp' declarator plus one
          // 'DestructuredProperty' declarator per destructured name, each
          // reading `_destructure_N.<name>` (see the 'DestructureTemp'
          // handling in transformForOfStatement's doc comment for the
          // matching for-of shape). Read the property directly via getattr
          // here instead of routing through the generic
          // `this._transformExpressionAsRead(declarator.init)` path below -
          // transformMemberExpression's dot-access special-casing
          // unconditionally folds ANY `.length` property read (regardless
          // of whether the receiver is actually an array/string) into
          // `_js_len(object)`, so destructuring a field that merely HAPPENS
          // to be named "length" on a plain object silently returns that
          // object's PYTHON iterable length instead of its real "length"
          // field's value (e.g. a Huffman code's bit-length, corrupting
          // every decoded symbol downstream).
          const destructObject = this.transformExpression(declarator.init.object);
          const destructPropName = declarator.init.property.name || declarator.init.property.value;
          value = new PythonCall(new PythonIdentifier('getattr'), [
            destructObject,
            PythonLiteral.Str(toSnakeCaseProperty(destructPropName)),
            PythonLiteral.None()
          ]);
        } else if (declarator.init &&
            declarator.init.type === 'CallExpression' &&
            (declarator.init.callee.type === 'FunctionExpression' ||
             declarator.init.callee.type === 'ArrowFunctionExpression')) {
          // Extract return value from IIFE
          const returnValue = this.getIIFEReturnValue(declarator.init);
          value = returnValue
            ? this.transformExpression(returnValue)
            : PythonLiteral.None();
        } else if (declarator.init && declarator.init.type === 'ObjectExpression') {
          // Pass the binding name through so any `this.foo` inside a
          // block-bodied method property (see transformObjectExpression)
          // resolves to this same variable, matching JS's `this === X`
          // when a method is called as `X.foo()`.
          value = this.transformObjectExpression(declarator.init, varName);
        } else if (declarator.init && declarator.init.type === 'ObjectLiteral') {
          // Same as the ObjectExpression branch above, but for the IL AST's
          // own object-literal node shape (see the 'ObjectLiteral' case in
          // transformExpression) - this is the shape the shared parser
          // actually produces for a plain `const X = {...}` almost always,
          // ObjectExpression only shows up from a handful of raw-AST-only
          // code paths. transformExpression has no per-call context
          // parameter to thread selfName through, so stash it in a one-shot
          // slot the 'ObjectLiteral' case consumes immediately - NOT a
          // this._objSelfNameStack push spanning the whole object literal:
          // a plain (non-function) property value like `keySize:
          // this.keySize` still executes in the *enclosing* method's `this`
          // (object literals don't create a new `this` binding in JS,
          // unlike a nested function property), so only the body of an
          // actual hoisted function-property may see the substitution.
          this._pendingObjLiteralSelfName = varName;
          try {
            value = this.transformExpression(declarator.init);
          } finally {
            this._pendingObjLiteralSelfName = null;
          }
        } else if (declarator.init && declarator.init.type === 'MemberExpression' && declarator.init.computed &&
                   this._undefinedCheckedVarNames && this._undefinedCheckedVarNames.has(declarator.id.name)) {
          // This declarator's own name is later compared against `undefined`
          // somewhere in the same method body (see the
          // `_undefinedCheckedVarNames` doc comment in the constructor) -
          // e.g. classical/playfair.js's odd-length-input lookahead `let
          // char2 = normalizedInput[i + 1]; if (char2 === undefined) {...}`.
          // Route through `_js_idx` instead of a raw Python subscript so an
          // out-of-range read yields None (matching JS) instead of raising
          // IndexError/KeyError before the guard ever gets a chance to run.
          const memberObject = this.transformExpression(declarator.init.object);
          const memberProperty = this.transformExpression(declarator.init.property);
          value = new PythonCall(new PythonIdentifier('_js_idx'), [memberObject, memberProperty]);
        } else if (declarator.init && this._transcendentalArgNames && this._transcendentalArgNames.has(declarator.id.name)) {
          // This declarator's own name is later fed to Math.log2/log/log10/
          // exp somewhere in the same method body (see the
          // `_transcendentalArgNames` doc comment in the constructor) - force
          // any `/` inside its initializer to stay a true float division
          // instead of the usual truncate-toward-array-index heuristic.
          const prevPreserveFloatDivision = this.preserveFloatDivision;
          this.preserveFloatDivision = true;
          try {
            value = this.transformExpression(declarator.init);
          } finally {
            this.preserveFloatDivision = prevPreserveFloatDivision;
          }
        } else {
          value = declarator.init
            ? this._transformExpressionAsRead(declarator.init)
            : PythonLiteral.None();
        }
        // Emit any hoisted statements (e.g. nested helper functions from
        // transformCallbackExpr) before this declarator's assignment.
        if (this.pendingPreStatements && this.pendingPreStatements.length > 0) {
          assignments.push(...this.pendingPreStatements);
          this.pendingPreStatements = [];
        }

        // Postfix increment/decrement used inside a subscript read in the
        // initializer (e.g. `let y = this._state[this._index++];`) queues
        // its side effect here rather than inline (Python has no `i++`
        // expression). Emitting it *after* this declarator's assignment
        // preserves JS's read-then-increment order; dropping it (as before)
        // left the index frozen forever, so every subsequent read silently
        // returned the same element - a class of PRNG/stream-cipher bugs
        // that manifests as a constant, non-advancing output.
        const declaratorPostStatements = this.pendingPostStatements && this.pendingPostStatements.length > 0
          ? [...this.pendingPostStatements]
          : [];
        this.pendingPostStatements = [];

        // Check if we need to wrap the value with int() for int-typed variables
        // JavaScript division of integers produces float, and when assigned to int var
        // Python needs explicit conversion
        let finalValue = value;
        if (declarator.id.typeAnnotation) {
          const annotatedType = this.mapType(declarator.id.typeAnnotation);
          if (annotatedType && annotatedType.name === 'int') {
            // Check if the initializer contains division
            if (this._containsDivision(declarator.init))
              finalValue = new PythonCall(new PythonIdentifier('int'), [value]);
          }
        }

        const assignment = new PythonAssignment(
          new PythonIdentifier(varName),
          finalValue
        );
        // Mark this as a genuine declaration (JS `const`/`let`/`var` inside
        // a function body always introduces a NEW binding local to that
        // function - even when it shares a name with an outer/module-level
        // variable, e.g. ed25519.js's module-level field-prime `const P =
        // 2^255-19` vs. scalarMult()'s unrelated local `const P = {x, y, z,
        // t}` extended-coordinate point). _addGlobalDeclarationsIfNeeded's
        // "needs global" scan (see _collectAssignedNames) must skip these -
        // treating a shadowing declaration as a `global` statement instead
        // makes the function permanently overwrite the outer variable the
        // moment it runs, corrupting every other reader of that name (mod_p
        // silently starts computing `int % JSObject` once scalar_mult has
        // clobbered the module's field-prime constant with a point struct).
        // Only a bare reassignment with no local declaration keyword
        // (transformAssignmentExpressionCore's plain PythonAssignment, which
        // never sets this flag) is the JS pattern that actually needs
        // `global` - e.g. a `let ready = false;` lazy-init flag flipped by
        // `ready = true;` with no `let`/`const` at the reassignment site.
        assignment.isDeclaration = true;

        // Type annotation (only if addTypeHints is enabled)
        if (this.addTypeHints) {
          if (declarator.id.typeAnnotation) {
            assignment.type = this.mapType(declarator.id.typeAnnotation);
            this.registerImportForType(assignment.type);
          } else if (declarator.init) {
            // Infer type from initializer
            const inferredType = this.inferFullExpressionType(declarator.init);
            // Add type hint if: strictTypes is true OR type is not 'Any'
            if (inferredType && (this.strictTypes || inferredType.name !== 'Any')) {
              assignment.type = inferredType;
            }
          }
        }

        assignments.push(assignment);
        if (declaratorPostStatements.length > 0)
          assignments.push(...declaratorPostStatements);

        // Track variable type
        if (assignment.type) {
          this.registerVariableType(declarator.id.name, assignment.type);
        }
      }

      // Restore whatever the enclosing context had pending before this
      // declaration ran - see the doc comment above outerPendingPre/
      // outerPendingPost. Everything THIS function accumulated for its own
      // declarators was already drained into `assignments` above.
      this.pendingPreStatements = outerPendingPre;
      this.pendingPostStatements = outerPendingPost;

      return assignments.length === 1 ? assignments[0] : assignments;
    }

    transformExpressionStatement(node) {
      // A SequenceExpression used as a whole statement (e.g. the C-style
      // `a++, b += 6;`, most commonly seen as a for-loop's update clause:
      // `for (...; ...; ++round, rcIndex += 6)`) evaluates every
      // comma-separated sub-expression for its side effects - unlike a
      // SequenceExpression used as a *value* (assigned/returned/tested),
      // where only the last one's result matters. transformExpression's
      // generic SequenceExpression case (below) intentionally keeps only the
      // last sub-expression since it must produce a single Python value; at
      // the statement level that silently drops every earlier side effect,
      // e.g. losing the `++round` counter entirely and leaving the loop
      // counter never incremented - an infinite loop (see aead/wage.js,
      // hash/blake.js, block/hpc.js, kdf/argon2.js, mac/zuc128mac.js, all of
      // which use this `++round, rcIndex += N` idiom in a for-loop update).
      // Expand each comma operand into its own statement instead.
      if (node.expression && node.expression.type === 'SequenceExpression') {
        const statements = [];
        for (const sub of node.expression.expressions) {
          const subStatements = this.transformExpressionStatement({ type: 'ExpressionStatement', expression: sub });
          if (Array.isArray(subStatements)) statements.push(...subStatements);
          else if (subStatements) statements.push(subStatements);
        }
        return statements;
      }

      // Clear pending pre/post-statements before transforming - but save
      // whatever the enclosing context already had queued first. This
      // statement isn't necessarily "top level": it can be reached while
      // processing a hoisted IIFE/callback helper's own body
      // (transformCallbackExpr -> transformBlockStatement -> a for-loop's
      // body statement, e.g.), nested inside an outer expression that has
      // ALSO queued a not-yet-flushed hoisted function of its own (a second
      // `seed: (function(){ for (...) {...}; return k; })()}` test-vector
      // property, hoisted while the FIRST one's helper is still sitting in
      // this.pendingPreStatements waiting for the enclosing array/object
      // literal to finish). Blindly clearing to `[]` here used to silently
      // drop that earlier hoisted function definition entirely - restore it
      // below instead of leaving `[]` once this statement's own pending
      // items have been captured (see the matching outerPendingPre/
      // outerPendingPost comment in transformVariableDeclaration for the
      // concrete repro: random/isaac.js's `_cb_1`/`_cb_2` test-seed
      // generators).
      const outerPendingPre = this.pendingPreStatements;
      const outerPendingPost = this.pendingPostStatements;
      this.pendingPostStatements = [];
      this.pendingPreStatements = [];

      const expr = this.transformExpression(node.expression);

      // Collect pre and post statements
      const preStatements = [...(this.pendingPreStatements || [])];
      const postStatements = [...this.pendingPostStatements];
      this.pendingPreStatements = outerPendingPre;
      this.pendingPostStatements = outerPendingPost;

      // If the expression transform returned a block (e.g., from destructuring),
      // return the block's statements instead of wrapping in ExpressionStatement
      if (expr && expr.nodeType === 'Block') {
        const statements = expr.statements || [];
        // Combine: pre-statements + block statements + post-statements
        if (preStatements.length > 0 || postStatements.length > 0) {
          return [...preStatements, ...statements, ...postStatements];
        }
        return statements;
      }

      // If the expression transform returned a statement (e.g., For from forEach),
      // return it directly instead of wrapping in ExpressionStatement
      const statementNodeTypes = ['For', 'While', 'If', 'TryExcept', 'With', 'Class', 'Function'];
      if (expr && statementNodeTypes.includes(expr.nodeType)) {
        if (preStatements.length > 0 || postStatements.length > 0) {
          return [...preStatements, expr, ...postStatements];
        }
        return expr;
      }

      // Check for pending pre/post statements
      if (preStatements.length > 0 || postStatements.length > 0) {
        const mainStatement = new PythonExpressionStatement(expr);
        return [...preStatements, mainStatement, ...postStatements];
      }

      return new PythonExpressionStatement(expr);
    }

    transformReturnStatement(node) {
      // If we're at module level (not inside a function/method), skip return
      // This handles UMD pattern's final return statement
      if (!this.currentFunction && !this.currentMethod && !this.currentClass) {
        // At module level, convert return { exports } to just the expression
        // or skip entirely if not useful
        if (node.argument) {
          // Could be return { ClassName: className } - just skip for Python
          return null;
        }
        return null;
      }

      // Clear pending pre/post-statements before transforming (mirrors
      // transformExpressionStatement) so callback hoisting (see
      // transformCallbackExpr) works inside `return arr.map(...)` etc.
      // Save whatever the enclosing context already had queued first -
      // this return statement is not necessarily "top level": it can be
      // reached while processing a hoisted IIFE/callback helper's own body
      // (transformCallbackExpr -> transformBlockStatement), nested inside
      // an outer expression that has ALSO queued a not-yet-flushed hoisted
      // function of its own (e.g. a second `seed: (function(){...})()}`
      // test-vector property, hoisted while the FIRST one's helper is still
      // sitting in this.pendingPreStatements waiting for the enclosing
      // array/object literal to finish). Blindly clearing to `[]` here (as
      // opposed to restoring it below once this statement's own pending
      // items have been captured) used to silently drop that earlier
      // hoisted function definition entirely - see the matching
      // outerPendingPre/outerPendingPost comment in
      // transformVariableDeclaration for the concrete repro
      // (random/isaac.js's `_cb_1`/`_cb_2` test-seed generators).
      const outerPendingPre = this.pendingPreStatements;
      const outerPendingPost = this.pendingPostStatements;
      this.pendingPostStatements = [];
      this.pendingPreStatements = [];

      // A directly-returned object literal (`return { Feed(){...}, set
      // key(v){...}, get key(){...} }`, e.g. CreateInstance in
      // pike.js/xchacha20.js/mars.js/lucifer.js) has no variable name for its
      // own hoisted method bodies to substitute for `this` - unlike `const
      // instance = {...}; return instance;` (handled in
      // transformVariableDeclaration/transformObjectExpression's selfName
      // param), which binds the object to a name first. Without one, falling
      // through to the plain `case 'ObjectExpression'`/`'ObjectLiteral'`
      // below (selfName/_pendingObjLiteralSelfName left unset) leaves
      // _objSelfNameStack's top whatever the *enclosing* hoisted function
      // happened to push - typically the containing algorithm object itself
      // (e.g. "pike") - so `this._key = ...` inside the returned object's own
      // setter silently reads/writes the wrong object's attributes instead
      // of the newly-created instance. Synthesize the same kind of temp
      // binding `const instance = {...}` would have provided.
      if (node.argument && (node.argument.type === 'ObjectExpression' || node.argument.type === 'ObjectLiteral')) {
        this._returnObjCounter = (this._returnObjCounter || 0) + 1;
        const tempName = '_ret_obj' + this._returnObjCounter;
        let value;
        if (node.argument.type === 'ObjectExpression') {
          value = this.transformObjectExpression(node.argument, tempName);
        } else {
          this._pendingObjLiteralSelfName = tempName;
          try {
            value = this.transformExpression(node.argument);
          } finally {
            this._pendingObjLiteralSelfName = null;
          }
        }
        const preStatements = [...(this.pendingPreStatements || [])];
        this.pendingPreStatements = outerPendingPre;
        this.pendingPostStatements = outerPendingPost;
        const tempAssign = new PythonAssignment(new PythonIdentifier(tempName), value);
        const returnStmt = new PythonReturn(new PythonIdentifier(tempName));
        return [...preStatements, tempAssign, returnStmt];
      }

      const expr = node.argument ? this.transformExpression(node.argument) : null;

      const preStatements = [...(this.pendingPreStatements || [])];
      const postStatements = [...this.pendingPostStatements];
      this.pendingPreStatements = outerPendingPre;
      this.pendingPostStatements = outerPendingPost;

      if (postStatements.length > 0 && expr) {
        // Deferred side effects (e.g. the increment of postfix i++ inside
        // `return arr[i++]`) were queued to run *after* the value is used,
        // matching JS semantics. But Python has no code-after-return - any
        // statement placed after `return` is unreachable dead code. Capture
        // the return value in a temp variable first, run the deferred side
        // effects, then return the temp - preserving both the "use old
        // value" semantics and the mutation.
        this._returnTmpCounter = (this._returnTmpCounter || 0) + 1;
        const tempVar = new PythonIdentifier('_return_tmp' + this._returnTmpCounter);
        const tempAssign = new PythonAssignment(tempVar, expr);
        const returnStmt = new PythonReturn(tempVar);
        return [...preStatements, tempAssign, ...postStatements, returnStmt];
      }

      const returnStmt = new PythonReturn(expr);
      if (preStatements.length > 0 || postStatements.length > 0) {
        return [...preStatements, returnStmt, ...postStatements];
      }
      return returnStmt;
    }

    /**
     * True when `name` is a parameter of the function/method currently
     * being transformed (see _currentFunctionNode) AND that function's own
     * body calls `name.push(...)` (or subscript-assigns into it) somewhere
     * - i.e. it's used as an optional "collect output into this array"
     * parameter (JSDoc'd `{Array|null}` throughout this codebase, e.g.
     * hash/panama.js's `_iterate(input, output)`, called as either
     * `_iterate(block, null)` or `_iterate(null, someArray)`).
     *
     * Backs the bare-identifier-condition special case in
     * transformIfStatement: JS objects/arrays are ALWAYS truthy regardless
     * of contents - `if (output)` where `output` is a legitimately-empty-
     * so-far array (e.g. a freshly-created `[]` about to be `.push()`ed
     * into) is still true - but Python's own falsy rules treat an empty
     * list as falsy. A plain `if output:` (this codebase's default
     * identifier-condition translation, correct for JS's OTHER falsy
     * values - 0, "", None, False - which coincide with Python's own) is
     * therefore wrong specifically for a not-yet-populated array/object
     * parameter: panama.js's finalize() passes a brand-new `[]` as
     * `output`, and `if (output)` selecting whether to emit keystream
     * bytes reads false on the very first (and only) check, silently
     * producing an empty hash for every input.
     */
    _isArrayLikeParam(name) {
      const fn = this._currentFunctionNode;
      if (!fn || !name) return false;
      const params = fn.params || [];
      if (!params.some(p => (p.name || p.value) === name)) return false;

      let cache = this._arrayLikeParamCache.get(fn);
      if (!cache) {
        cache = new Set();
        const seen = new Set();
        const visit = (n) => {
          if (!n || typeof n !== 'object' || seen.has(n)) return;
          seen.add(n);
          // `.push(...)`/`.fill(...)` calls are normalized by the shared
          // type-aware-transpiler.js parser into dedicated IL nodes
          // ('ArrayAppend'/'ArrayFill', each carrying the receiver under
          // `.array`) before this transformer ever sees them - a raw
          // CallExpression with a MemberExpression callee (checked below
          // too, as a fallback for any shape the shared parser doesn't
          // normalize) never actually occurs for these two methods.
          if ((n.type === 'ArrayAppend' || n.type === 'ArrayFill') &&
              n.array && n.array.type === 'Identifier') {
            cache.add(n.array.name);
          }
          if (n.type === 'CallExpression' && n.callee && n.callee.type === 'MemberExpression' &&
              !n.callee.computed && n.callee.object && n.callee.object.type === 'Identifier' &&
              (n.callee.property?.name === 'push' || n.callee.property?.name === 'fill')) {
            cache.add(n.callee.object.name);
          }
          // A direct indexed-assignment target (`name[i] = value`, e.g.
          // aead/paef-forkskinny.js's `forkskinny_128_256_encrypt`, which
          // fills an optional `output_left`/`output_right` "out" parameter
          // this same way instead of via .push()/.fill()) is exactly the
          // same "collect output into this array" idiom - the parameter is
          // only ever WRITTEN into via subscript, never read as a number/
          // string/boolean, so it's array-like by construction.
          if (n.type === 'AssignmentExpression' && n.left && n.left.type === 'MemberExpression' &&
              n.left.computed && n.left.object && n.left.object.type === 'Identifier') {
            cache.add(n.left.object.name);
          }
          for (const k in n) {
            if (k === 'parent') continue;
            const v = n[k];
            if (Array.isArray(v)) v.forEach(visit);
            else if (v && typeof v === 'object') visit(v);
          }
        };
        visit(fn.body);
        this._arrayLikeParamCache.set(fn, cache);
      }
      return cache.has(name);
    }

    /**
     * True if `node` is a bare Identifier naming an `_isArrayLikeParam`
     * parameter, a `!`-negation of one, or a '&&'/'||' combination
     * involving one - exactly the shapes `_buildArrayAwareCondition` below
     * knows how to special-case for JS's array truthiness. Used to decide
     * whether a condition needs that special handling at all before
     * rebuilding it (leaving every OTHER condition - the overwhelming
     * majority - on the untouched, existing `transformExpression` path).
     */
    _containsArrayLikeCondition(node) {
      if (!node) return false;
      if (node.type === 'Identifier') return this._isArrayLikeParam(node.name);
      if (node.type === 'UnaryExpression' && node.operator === '!') return this._containsArrayLikeCondition(node.argument);
      if (node.type === 'LogicalExpression' && (node.operator === '&&' || node.operator === '||'))
        return this._containsArrayLikeCondition(node.left) || this._containsArrayLikeCondition(node.right);
      return false;
    }

    /**
     * Recursively rebuild a condition `_containsArrayLikeCondition` matched,
     * translating every array-like-param leaf to an `... is (not) None`
     * check (see _isArrayLikeParam's doc comment: JS arrays/objects are
     * ALWAYS truthy regardless of contents, unlike Python's empty-list-is-
     * falsy rule) instead of the generic Python truthiness
     * `transformExpression` would otherwise produce - e.g.
     * aead/paef-forkskinny.js's `forkskinny_128_256_encrypt(tweakey,
     * output_left, output_right, input)`: `if (output_left &&
     * output_right)` / `else if (!output_left && output_right)`, where
     * `output_right` is frequently a legitimately-still-empty `[]` about to
     * be filled index-by-index. Any OTHER leaf combined into the same
     * &&/|| chain (a plain number/string/boolean condition) stays on the
     * normal path.
     */
    _buildArrayAwareCondition(node) {
      if (node.type === 'Identifier' && this._isArrayLikeParam(node.name))
        return new PythonBinaryExpression(this.transformExpression(node), 'is not', PythonLiteral.None());
      if (node.type === 'UnaryExpression' && node.operator === '!' &&
          node.argument.type === 'Identifier' && this._isArrayLikeParam(node.argument.name))
        return new PythonBinaryExpression(this.transformExpression(node.argument), 'is', PythonLiteral.None());
      if (node.type === 'LogicalExpression' && (node.operator === '&&' || node.operator === '||')) {
        const left = this._containsArrayLikeCondition(node.left) ? this._buildArrayAwareCondition(node.left) : this.transformExpression(node.left);
        const right = this._containsArrayLikeCondition(node.right) ? this._buildArrayAwareCondition(node.right) : this.transformExpression(node.right);
        return new PythonBinaryExpression(left, node.operator === '&&' ? 'and' : 'or', right);
      }
      return this.transformExpression(node);
    }

    transformIfStatement(node) {
      // Drop CommonJS dependency-loading guards wherever they appear (not just at
      // module top level) - 'require' has no meaning in transpiled Python.
      if (this.isRequireGuard(node.test)) return null;

      // Check if the condition contains UpdateExpression (++/--) that needs extraction
      const preStatements = [];
      const testNode = this.extractUpdateExpressionsFromCondition(node.test, preStatements);

      // `if (param)` where `param` is an optional "collect into this
      // array" parameter (see _isArrayLikeParam's doc comment) - a plain
      // truthiness translation is wrong for a legitimately-empty-so-far
      // array/object (always truthy in JS, falsy in Python when empty).
      let condition;
      if (this._containsArrayLikeCondition(testNode)) {
        condition = this._buildArrayAwareCondition(testNode);
      } else {
        condition = this.transformExpression(testNode);
      }
      const thenBranch = this.transformBlockOrStatement(node.consequent);
      const elseBranch = node.alternate ? this.transformBlockOrStatement(node.alternate) : null;

      // Handle elif chains
      const elifBranches = [];
      let finalElse = elseBranch;

      if (elseBranch && elseBranch.nodeType === 'If') {
        // Convert else-if to elif
        elifBranches.push({
          condition: elseBranch.condition,
          body: elseBranch.thenBranch
        });
        finalElse = elseBranch.elseBranch;
      }

      const ifStmt = new PythonIf(condition, thenBranch, elifBranches, finalElse);

      // If there are pre-statements (from extracted UpdateExpressions), return array
      if (preStatements.length > 0) {
        return [...preStatements, ifStmt];
      }

      return ifStmt;
    }

    /**
     * Extract UpdateExpressions and AssignmentExpressions from a condition and convert to pre-statements
     * For prefix (--x): add "x -= 1" before, use x in condition
     * For postfix (x--): add temp assignment before, add "x -= 1" before, use temp in condition
     * For assignment (x += 1): add "x += 1" before, use x in condition
     */
    extractUpdateExpressionsFromCondition(node, preStatements) {
      if (!node) return node;

      // Handle AssignmentExpression (x += 1, x = value, etc.)
      if (node.type === 'AssignmentExpression') {
        // Extract the assignment as a pre-statement
        const assignmentStmt = this.transformExpressionStatement({
          type: 'ExpressionStatement',
          expression: node
        });
        if (Array.isArray(assignmentStmt)) {
          preStatements.push(...assignmentStmt);
        } else {
          preStatements.push(assignmentStmt);
        }
        // Return the target variable for use in the condition
        return node.left;
      }

      // Handle both UpdateExpression and UnaryExpression with ++ or --
      const isUpdate = node.type === 'UpdateExpression' ||
        (node.type === 'UnaryExpression' && (node.operator === '++' || node.operator === '--'));

      if (isUpdate) {
        // node.argument isn't always a plain Identifier - `++this.foo`/
        // `this.foo++` (seal.js's `if (++this.insideCounter ===
        // this.iterationsPerCount)`) has a ThisPropertyAccess/MemberExpression
        // argument instead, which has no `.name` at all. The old
        // `node.argument.name || ... : 'var'` fallback silently substituted
        // the literal string "var" as the variable name in that case,
        // producing a bogus module-level `var = var + 1` statement (Python
        // then treats `var` as an uninitialized local, since nothing else in
        // the function ever assigns to a variable actually called "var") -
        // instead of incrementing the real target. Build the actual target
        // expression with the normal transform (handles Identifier,
        // ThisPropertyAccess, MemberExpression, everything else) rather than
        // re-deriving a bare identifier name by hand.
        const targetExpr = this.transformExpression(node.argument);
        const op = node.operator === '++' ? '+' : '-';
        const updateStmt = new PythonExpressionStatement(
          new PythonAssignment(
            targetExpr,
            new PythonBinaryExpression(
              targetExpr,
              op,
              PythonLiteral.Int(1)
            )
          )
        );

        if (node.prefix) {
          // Prefix: --x means decrement first, then use new value
          preStatements.push(updateStmt);
          return node.argument; // Return the variable reference
        } else {
          // Postfix: x-- means use old value, then decrement
          // We need to capture old value. Use a counter-based temp name -
          // unlike a bare identifier, an arbitrary target expression
          // (member access, subscript, ...) has no single "name" to derive
          // one from, and a counter is unique regardless of target shape.
          this._condUpdateTempCounter = (this._condUpdateTempCounter || 0) + 1;
          const tempName = '_pre_update_' + this._condUpdateTempCounter;
          preStatements.push(new PythonExpressionStatement(
            new PythonAssignment(
              new PythonIdentifier(tempName),
              targetExpr
            )
          ));
          preStatements.push(updateStmt);
          return { type: 'Identifier', name: tempName }; // Return temp reference
        }
      }

      // Recursively check binary and logical expressions
      if (node.type === 'BinaryExpression' || node.type === 'LogicalExpression') {
        return {
          ...node,
          left: this.extractUpdateExpressionsFromCondition(node.left, preStatements),
          right: this.extractUpdateExpressionsFromCondition(node.right, preStatements)
        };
      }

      // Handle parenthesized expressions
      if (node.type === 'ParenthesizedExpression') {
        return {
          ...node,
          expression: this.extractUpdateExpressionsFromCondition(node.expression, preStatements)
        };
      }

      // Handle call expressions - don't descend into arguments to avoid extracting
      // legitimate expressions, but check if the callee itself has updates
      if (node.type === 'CallExpression') {
        return {
          ...node,
          callee: this.extractUpdateExpressionsFromCondition(node.callee, preStatements)
        };
      }

      // Handle member expressions
      if (node.type === 'MemberExpression') {
        return {
          ...node,
          object: this.extractUpdateExpressionsFromCondition(node.object, preStatements),
          property: node.computed
            ? this.extractUpdateExpressionsFromCondition(node.property, preStatements)
            : node.property
        };
      }

      return node;
    }

    transformForStatement(node) {
      // Detect range-based for loops: for (let i = 0; i < n; i++)
      if (this.isRangeBasedFor(node)) {
        return this.transformRangeFor(node);
      }

      // Convert to while loop for complex cases
      return this.transformForAsWhile(node);
    }

    isRangeBasedFor(node) {
      // Check if it's a simple for loop: for (let i = 0; i < n; i++)
      if (!node.init || !node.test || !node.update) return false;

      const init = node.init;
      const test = node.test;
      const update = node.update;

      // Check init: let i = 0
      if (init.type !== 'VariableDeclaration') return false;
      if (init.declarations.length !== 1) return false;
      const decl = init.declarations[0];
      if (!decl.init || decl.init.type !== 'Literal') return false;

      // Check test: i < n
      if (test.type !== 'BinaryExpression') return false;
      if (test.operator !== '<' && test.operator !== '<=') return false;
      // The tested value must be the BARE loop variable itself, not some
      // scaled/derived expression of it - e.g. aead/deoxys-ii.js's `for (let
      // index = 0; index * 16 < aad.length; ++index)` (iterate once per
      // 16-byte block) has `test.left` as `index * 16`, a BinaryExpression,
      // not a plain Identifier. transformRangeFor blindly uses `test.right`
      // (`aad.length`) as the Python range() end without ever looking at
      // `test.left` beyond confirming it's some comparison - so a 32-byte
      // `aad` incorrectly produced `range(0, 32)` (32 iterations) instead
      // of the intended `range(0, 2)` (32 / 16 = 2 one-per-block
      // iterations), reading 30 bytes past the end of every AAD block after
      // the first and corrupting the authentication tag. Only a `test.left`
      // that IS the loop variable is a genuine "count from 0/start to n"
      // range; anything else must fall through to the general
      // condition-preserving transformForAsWhile below.
      if (!test.left || test.left.type !== 'Identifier' || test.left.name !== decl.id.name) return false;

      // Check update: i++ or ++i. This parser (unlike standard ESTree)
      // represents *prefix* ++i/--i as a UnaryExpression, reserving
      // UpdateExpression for the postfix form i++/i-- - see the same
      // both-types check used throughout this file (e.g.
      // extractUpdateExpressionsFromCondition above). Missing the
      // UnaryExpression form here meant every `for (...; ...; ++i)` loop
      // (prefix increment, extremely common in this codebase) fell through
      // to transformForAsWhile's while-loop conversion instead of a native
      // Python `for i in range(...)`. That matters beyond style: a `continue`
      // inside such a while-loop jumps straight to the condition check and
      // skips the increment appended at the end of the loop body, breaking
      // JS `for`-loop semantics where `continue` still runs the update
      // clause - i never advances, so the loop spins forever (e.g.
      // asymmetric/rabin.js's Miller-Rabin witness loop hung the interpreter).
      const isUpdate = update.type === 'UpdateExpression' ||
        (update.type === 'UnaryExpression' && (update.operator === '++' || update.operator === '--'));
      if (!isUpdate) return false;
      if (update.operator !== '++') return false;

      // The incremented variable must be the loop variable itself - a for
      // loop that increments something else (`for (let i = 0; i < n; ++j)`)
      // is not a plain counting loop and must not be rewritten as a Python
      // range() (which owns and advances the loop variable itself).
      if (!update.argument || update.argument.type !== 'Identifier') return false;
      if (update.argument.name !== decl.id.name) return false;

      return true;
    }

    transformRangeFor(node) {
      const varName = toSnakeCase(node.init.declarations[0].id.name);
      const start = this.transformExpression(node.init.declarations[0].init);
      let end = this.transformExpression(node.test.right);

      // JS `i <= n` is an inclusive bound; Python's range() is exclusive,
      // so the end must be bumped by one to include the final iteration.
      if (node.test.operator === '<=') {
        if (end instanceof PythonLiteral && typeof end.value === 'number' && Number.isInteger(end.value)) {
          end = PythonLiteral.Int(end.value + 1);
        } else {
          end = new PythonBinaryExpression(end, '+', PythonLiteral.Int(1));
        }
      }

      // Create range() call
      const rangeCall = new PythonCall(
        new PythonIdentifier('range'),
        [this._asIntBound(start), this._asIntBound(end)]
      );

      const body = this.transformBlockOrStatement(node.body);
      return new PythonFor(varName, rangeCall, body);
    }

    /**
     * range() (unlike JS's `<`/`++` loop bounds) requires an actual int and
     * raises TypeError on a float - and JS code freely uses a float-valued
     * expression as a loop bound/count since JS numbers don't distinguish
     * int/float (e.g. `for (let b = 0; b < Math.log2(n); b++)`: Math.log2
     * always returns a float in both JS and Python, but JS's `<` comparison
     * and `++` don't care). Wrap anything not already visibly an int
     * (a literal integer, or already the result of int()/len()/_js_len()) so
     * a float leaking in from upstream arithmetic (log2, division, sqrt...)
     * doesn't crash range() - see e.g. polar-code.js/hadamard-code.js's
     * `Math.log2(n)`-derived loop bound.
     */
    _asIntBound(expr) {
      if (expr instanceof PythonLiteral && typeof expr.value === 'number' && Number.isInteger(expr.value)) return expr;
      if (expr instanceof PythonCall && expr.func instanceof PythonIdentifier &&
          (expr.func.name === 'int' || expr.func.name === 'len' || expr.func.name === '_js_len')) return expr;
      return new PythonCall(new PythonIdentifier('int'), [expr]);
    }

    transformForAsWhile(node) {
      // Convert complex for loops to while loops
      const block = new PythonBlock();

      // Add initialization
      if (node.init) {
        let init;
        // Handle both statement-type init (VariableDeclaration) and expression-type init (AssignmentExpression)
        if (node.init.type === 'VariableDeclaration') {
          init = this.transformStatement(node.init);
        } else {
          // Expression type (e.g., AssignmentExpression like "round = 24")
          const expr = this.transformExpression(node.init);
          if (expr) {
            init = new PythonExpressionStatement(expr);
          }
        }
        if (init) {
          if (Array.isArray(init)) {
            block.statements.push(...init);
          } else {
            block.statements.push(init);
          }
        }
      }

      // Extract UpdateExpressions and AssignmentExpressions from the test condition
      // For patterns like: for (let i = 0; i-- > 0; ) which uses postfix decrement in condition
      const preStatements = [];
      const cleanedTest = node.test ? this.extractUpdateExpressionsFromCondition(node.test, preStatements) : null;

      // Create while loop
      const condition = cleanedTest ? this.transformExpression(cleanedTest) : PythonLiteral.Bool(true);
      const whileBody = this.transformBlockOrStatement(node.body);

      // Collect the per-iteration "advance" statements: any pre-statements
      // extracted from the test condition, then the for-loop's own update
      // clause (a SequenceExpression update like `++round, rcIndex += 6`
      // must run every comma-separated sub-expression, not just the last -
      // see transformExpressionStatement's SequenceExpression handling
      // above for why losing `++round` there is an infinite loop).
      const advanceStatements = [...preStatements];
      if (node.update) {
        if (node.update.type === 'SequenceExpression') {
          for (const sub of node.update.expressions) {
            advanceStatements.push(new PythonExpressionStatement(this.transformExpression(sub)));
          }
        } else {
          advanceStatements.push(new PythonExpressionStatement(this.transformExpression(node.update)));
        }
      }

      // A plain `continue;` translated straight into the while-loop body
      // below (with the advance statements merely appended after it) is
      // wrong: Python's `continue` jumps straight to the while condition,
      // skipping everything appended after it in the loop body - unlike a
      // real JS `for` loop, where `continue` still runs the update clause
      // before re-testing the condition. Losing the update means the loop
      // variable never advances and the loop spins forever (e.g.
      // asymmetric/rabin.js's Miller-Rabin witness loop hung on exactly
      // this). Guard the fix to loops with an own-level `continue` and no
      // own-level `break` at the same loop level (nested loops/functions
      // scope their own break/continue and don't count) - a `break` also
      // trips a `finally`, which would otherwise run one extra, spurious
      // advance step JS itself would have skipped, corrupting the loop
      // variable's value for any code reading it after the loop.
      if (advanceStatements.length > 0 && this._hasOwnLevelContinueNoBreak(node.body)) {
        const tryExcept = new PythonTryExcept();
        tryExcept.tryBlock = whileBody;
        if (!tryExcept.tryBlock.statements || tryExcept.tryBlock.statements.length === 0) {
          tryExcept.tryBlock.statements = [new PythonPass()];
        }
        tryExcept.finallyBlock = new PythonBlock();
        tryExcept.finallyBlock.statements = advanceStatements;
        const wrappedBody = new PythonBlock();
        wrappedBody.statements = [tryExcept];

        for (const stmt of preStatements) {
          block.statements.push(stmt);
        }
        block.statements.push(new PythonWhile(condition, wrappedBody));
        return block.statements.length === 1 ? block.statements[0] : block.statements;
      }

      // Common case: no own-level continue (or a break shares this loop
      // level, see above) - append the advance statements directly, same as
      // before.
      whileBody.statements.push(...advanceStatements);

      // Add pre-statements before the while loop for the initial check
      for (const stmt of preStatements) {
        block.statements.push(stmt);
      }

      block.statements.push(new PythonWhile(condition, whileBody));

      return block.statements.length === 1 ? block.statements[0] : block.statements;
    }

    /**
     * Walks a for-loop's JS body (pre-transform AST, not the Python one)
     * looking for a `continue`/`break` that targets *this* loop - i.e. not
     * one belonging to a nested loop or function, whose own break/continue
     * are lexically scoped to themselves. Used by transformForAsWhile to
     * decide whether it's safe/necessary to wrap the loop body in a
     * try/finally so `continue` still runs the advance (update) statements
     * - see the call site for the full rationale.
     *
     * Descends into constructs that share the enclosing loop's break/continue
     * target (blocks, if/else, try/catch/finally) but stops at anything that
     * introduces its own target: nested loops (their break/continue are
     * their own), functions (break/continue can't cross a function
     * boundary), and switch statements (conservatively treated as opaque -
     * a `break` inside one belongs to the switch, not the loop, but getting
     * that exactly right isn't worth the complexity here; treating switch
     * as opaque just means this optimization is missed for that shape, never
     * applied incorrectly).
     */
    _hasOwnLevelContinueNoBreak(node) {
      let hasContinue = false;
      let hasBreak = false;
      const visit = (n) => {
        if (!n || typeof n !== 'object' || hasBreak) return;
        switch (n.type) {
          case 'ContinueStatement':
            if (!n.label) hasContinue = true;
            return;
          case 'BreakStatement':
            if (!n.label) hasBreak = true;
            return;
          case 'BlockStatement':
            for (const s of n.body) { visit(s); if (hasBreak) return; }
            return;
          case 'IfStatement':
            visit(n.consequent);
            if (!hasBreak) visit(n.alternate);
            return;
          case 'TryStatement':
            if (n.block) visit(n.block);
            if (!hasBreak && n.handler && n.handler.body) visit(n.handler.body);
            if (!hasBreak && n.finalizer) visit(n.finalizer);
            return;
          case 'LabeledStatement':
            visit(n.body);
            return;
          // Anything else (nested loops, functions, switch, etc.) introduces
          // its own break/continue target - do not descend.
          default:
            return;
        }
      };
      visit(node);
      return hasContinue && !hasBreak;
    }

    transformWhileStatement(node) {
      // Check if the condition contains UpdateExpression or AssignmentExpression
      const preStatements = [];
      const testNode = this.extractUpdateExpressionsFromCondition(node.test, preStatements);

      const condition = this.transformExpression(testNode);
      const body = this.transformBlockOrStatement(node.body);
      const whileStmt = new PythonWhile(condition, body);

      // If there are pre-statements, we need to add them before the while loop
      // AND at the end of the while body to maintain the same semantics.
      // MUST be the END, not the start: these statements compute the NEXT
      // iteration's condition value (e.g. `while (i--) { ...block[i]...}` -
      // extractUpdateExpressionsFromCondition captures `_pre_update_1 = i;
      // i = i - 1` as the update), so the body itself must still observe
      // whatever value the PREVIOUS check (either the initial one before
      // the loop, or the previous iteration's own trailing copy of this
      // same update) left behind - appending them here re-runs the
      // JS-condition's own side effect exactly once per iteration, in the
      // same relative position (right before the next check) as JS's real
      // evaluation order. Prepending them instead ran the update BEFORE the
      // body got to use the counter/target variable, off-by-one-shifting
      // every read inside the body to the value one step further along
      // than JS's own (e.g. compression/deflate's sibling `while (i--)`
      // idiom in kdf/balloon.js's `_blockToInt` silently skipped the
      // buffer's most-significant byte and read one index short at every
      // later step, corrupting the mixing index for any input large enough
      // to exercise more than a couple of loop iterations).
      if (preStatements.length > 0) {
        const originalStatements = body.statements || [];
        body.statements = [...originalStatements, ...preStatements.map(s => s)];

        // Return pre-statements + while loop
        return [...preStatements, whileStmt];
      }

      return whileStmt;
    }

    /**
     * Transform JavaScript for...of statement to Python for...in
     * JS: for (const item of iterable) { ... }
     * Python: for item in iterable: ...
     */
    transformForOfStatement(node) {
      // Get the loop variable name
      let varName;
      // Destructuring loop variable: `for (const [pair, count] of X)`. The
      // shared IL parser flattens this into a VariableDeclaration with a
      // synthetic first declarator (ilNodeType 'DestructureTemp', e.g.
      // `_destructure_0`) - the actual per-iteration binding - followed by
      // one 'DestructuredElement' declarator per pattern name, each
      // initialized from a `_destructure_0[i]` MemberExpression. Those
      // element declarators describe *per-iteration* unpacking (the same
      // shape as a plain VariableDeclaration), so re-emit them as the first
      // statements of the loop body instead of dropping them - the flat
      // single-declarator paths below only handle a plain identifier and
      // silently discarded these before, leaving `pair`/`count` referenced
      // in the body with nothing ever assigning them (NameError).
      let destructureElementStatements = null;
      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        if (decl && decl.ilNodeType === 'DestructureTemp' && decl.id && decl.id.name &&
            node.left.declarations.length > 1) {
          varName = toSnakeCase(decl.id.name);
          destructureElementStatements = [];
          for (let i = 1; i < node.left.declarations.length; i++) {
            const elDecl = node.left.declarations[i];
            if (!elDecl || !elDecl.id || !elDecl.id.name || !elDecl.init) continue;
            destructureElementStatements.push(new PythonAssignment(
              new PythonIdentifier(toSnakeCase(elDecl.id.name)),
              this.transformExpression(elDecl.init)
            ));
          }
        } else if (decl && decl.id && decl.id.name) {
          varName = toSnakeCase(decl.id.name);
        } else if (decl && decl.id && decl.id.type === 'Identifier') {
          varName = toSnakeCase(decl.id.name);
        } else {
          this.warnings.push('Cannot extract variable name from for-of declaration');
          varName = 'item';
        }
      } else if (node.left.type === 'Identifier') {
        varName = toSnakeCase(node.left.name);
      } else {
        this.warnings.push('Unsupported for-of left-hand side: ' + node.left.type);
        varName = 'item';
      }

      // Get the iterable expression
      let iterable = this.transformExpression(node.right);

      // `for (const [key, value] of thisMap)` - a real JS Map's default
      // iterator already yields `[key, value]` entry pairs (that's exactly
      // why the destructuring above works at all), but its Python dict
      // stand-in does NOT: a bare `for x in some_dict:` only ever yields the
      // KEYS, so the destructure statements above (`key = _destructure_0[0];
      // value = _destructure_0[1]`) end up indexing/slicing a single KEY
      // instead of unpacking an entry pair - e.g. compression/dna-
      // compression.js's `for (const [key, info] of this.kmerTable)` left
      // `info` bound to a lone character of the key string, whose `.count`
      // attribute read then resolves to Python's OWN unrelated `str.count`
      // bound method instead of the JSObject entry's real `count` field.
      // `.items()` restores the real entry-pair iteration a Map guarantees.
      // Scoped strictly to the 2-element destructure shape over a
      // known-Map-typed expression - a plain `for (const x of thisMap)`
      // (single-variable, no destructure) already correctly wants Python
      // dict's own key-only iteration, matching `Map.prototype.keys()`...
      // no, actually matching `for...of` on a bare Map, which iterates
      // ENTRIES not keys; but with no destructure pattern, `x` would then
      // hold the pair itself (a real Map's default iterator result),
      // exactly like `.items()` yielding `(k, v)` tuples - so `.items()` is
      // correct there too, but that shape doesn't currently arise in this
      // codebase's for-of-over-Map usage and is left untouched to minimize
      // risk.
      if (destructureElementStatements && node.right && node.right.resultType === 'Map') {
        // list(...) snapshots the entries up front - a live `.items()` VIEW
        // raises `RuntimeError: dictionary changed size during iteration`
        // the instant the loop body deletes a key from this same Map (a
        // real JS Map safely tolerates exactly that during a for...of, e.g.
        // dna-compression.js's k-mer-table pruning loop:
        // `this.kmerTable.delete(key)` from inside the loop iterating it).
        // A snapshot behaves identically to the live view whenever the body
        // does NOT mutate the map, so this is safe unconditionally.
        iterable = new PythonCall(new PythonIdentifier('list'), [
          new PythonCall(new PythonMemberAccess(iterable, 'items'), [])
        ]);
      }

      // Get the loop body
      const body = this.transformBlockOrStatement(node.body);

      if (destructureElementStatements && destructureElementStatements.length > 0) {
        body.statements.unshift(...destructureElementStatements);
      }

      // Create Python for loop
      return new PythonFor(
        new PythonIdentifier(varName),
        iterable,
        body
      );
    }

    /**
     * Transform JavaScript for...in statement to Python for...in
     * JS: for (const key in object) { ... }
     * Python: for key in object: ... (or for key in object.keys(): ...)
     */
    transformForInStatement(node) {
      // Get the loop variable name
      let varName;
      if (node.left.type === 'VariableDeclaration') {
        // Handle VariableDeclaration with nested structure
        const decl = node.left.declarations[0];
        if (decl && decl.id && decl.id.name) {
          varName = toSnakeCase(decl.id.name);
        } else if (decl && decl.id && decl.id.type === 'Identifier') {
          varName = toSnakeCase(decl.id.name);
        } else {
          this.warnings.push('Cannot extract variable name from for-in declaration');
          varName = 'key';
        }
      } else if (node.left.type === 'Identifier') {
        varName = toSnakeCase(node.left.name);
      } else {
        this.warnings.push('Unsupported for-in left-hand side: ' + node.left.type);
        varName = 'key';
      }

      // Get the object expression - for objects, we iterate over keys
      const obj = this.transformExpression(node.right);

      // Get the loop body
      const body = this.transformBlockOrStatement(node.body);

      // JS `for (const key in obj)` iterates the object's own enumerable
      // KEYS. `obj` here is almost always a plain object literal, which
      // this transpiler represents as a JSObject instance (a real Python
      // `dict` only shows up incidentally) - and JSObject deliberately has
      // no `__iter__` of its own (adding one regressed a wide swath of
      // OTHER code across the suite that checks/relies on JSObject NOT
      // being iterable - e.g. duck-typed "is this array-like" tests). With
      // no `__iter__`, `for key in obj:` falls back to Python's legacy
      // indexed-iteration protocol (repeatedly calling `obj[0]`, `obj[1]`,
      // ... via JSObject's __getitem__), since __getitem__ never raises
      // IndexError to signal "stop" - `key` silently becomes a sequence of
      // integers (or whatever a numeric-keyed __getitem__ probe happens to
      // return) instead of the object's actual string keys, corrupting
      // every consumer (e.g. classical/al-kindi-frequency.js's letter-
      // frequency table lookup, `percentages[letter] = counts[letter] /
      // total`, indexing by an int instead of a letter). Call `.keys()`
      // explicitly instead - both JSObject and a real dict define it, so
      // this works either way without needing a generic (and, per the
      // above, unsafe) `__iter__` on JSObject itself. Plain `.keys()` only
      // ever gives Python dict/JSObject insertion order though - a real JS
      // object's enumeration order sorts integer-like keys ascending ahead
      // of everything else (see the '_js_object_keys' HELPER_STUBS doc
      // comment), so route through that same ordering helper here too
      // rather than `.keys()` directly.
      const keysExpr = new PythonCall(new PythonIdentifier('_js_object_keys'), [obj]);

      return new PythonFor(
        new PythonIdentifier(varName),
        keysExpr,
        body
      );
    }

    transformDoWhileStatement(node) {
      // Python doesn't have do-while, convert to while True with break
      const body = this.transformBlockOrStatement(node.body);
      const condition = this.transformExpression(node.test);

      // Add condition check at end with break
      const notCondition = new PythonUnaryExpression('not', condition);
      const breakIf = new PythonIf(notCondition,
        (() => {
          const b = new PythonBlock();
          b.statements.push(new PythonBreak());
          return b;
        })(),
        [], null);

      body.statements.push(breakIf);

      return new PythonWhile(PythonLiteral.Bool(true), body);
    }

    transformSwitchStatement(node) {
      // Transform switch to if/elif/else chain
      if (node.cases.length === 0) {
        return null;
      }

      const discriminant = this.transformExpression(node.discriminant);

      // Fold the common "shared body via stacked labels" JS idiom -
      // `case 'A': case 'B': <body>` - into a single group tested with an
      // OR of every accumulated test. A `case` with an EMPTY consequent
      // never executes anything of its own; it only exists to fall through
      // into the next label's body, so grouping is unconditionally safe
      // here (unlike a non-empty body missing a `break`, which would need
      // control-flow analysis to fold correctly and risks misordering
      // side effects - out of scope). Without this, e.g. pbkdf1.js's
      // `case 'SHA-1': case 'SHA1': return 20;` emitted the first label as
      // its own `if` with an empty (pass) body - silently dropping the
      // `return 20` for 'SHA-1' and returning None instead.
      const groups = [];
      let pendingTests = [];
      for (let i = 0; i < node.cases.length; i++) {
        const caseNode = node.cases[i];
        pendingTests.push(caseNode.test);
        if (caseNode.consequent.length > 0 || i === node.cases.length - 1) {
          groups.push({ tests: pendingTests, consequent: caseNode.consequent, hasDefault: pendingTests.some(t => t === null) });
          pendingTests = [];
        }
      }

      // A case whose body has real statements but doesn't end in break/
      // return/throw/continue genuinely falls through into the NEXT case's
      // body at runtime (e.g. twofish.js's key-size switch: `case 0: ...;
      // // fall through; case 3: ...; // fall through; case 2: ...;
      // break;`, where a 256-bit key must run all three bodies). The
      // if/elif chain below only ever runs ONE branch's body, silently
      // dropping every subsequent case's statements for that match - use
      // the cascading, flag-guarded lowering instead whenever that's
      // observable (i.e. any non-last group both has a body of its own and
      // doesn't terminate it).
      const TERMINATORS = new Set(['BreakStatement', 'ReturnStatement', 'ThrowStatement', 'ContinueStatement']);
      const lastRealStatementType = (consequent) => {
        for (let i = consequent.length - 1; i >= 0; i--) {
          if (consequent[i].type !== 'EmptyStatement') return consequent[i].type;
        }
        return null;
      };
      const fallsThrough = (consequent) => consequent.length > 0 && !TERMINATORS.has(lastRealStatementType(consequent));
      const needsFallthroughLowering = groups.some((g, idx) => idx < groups.length - 1 && !g.hasDefault && fallsThrough(g.consequent));

      if (needsFallthroughLowering) {
        return this._transformSwitchWithFallthrough(discriminant, groups, fallsThrough);
      }

      let currentIf = null;
      let lastIf = null;

      for (const group of groups) {
        const caseBody = this.transformSwitchCaseBody(group.consequent);
        const realTests = group.tests.filter(t => t !== null);

        // A default folded together with real tests (e.g. `default: case
        // 'x':` sharing one body) or a lone default acts as the final
        // unconditional else - it matches "everything else" so no
        // condition can express it.
        if (group.hasDefault) {
          if (currentIf) {
            lastIf.elseBranch = caseBody;
          } else {
            return caseBody;
          }
          continue;
        }

        let condition = null;
        for (const test of realTests) {
          const testExpr = new PythonBinaryExpression(discriminant, '==', this.transformExpression(test));
          condition = condition ? new PythonBinaryExpression(condition, '||', testExpr) : testExpr;
        }
        if (!condition) continue;

        const ifStmt = new PythonIf(condition, caseBody, [], null);
        if (!currentIf) {
          currentIf = ifStmt;
          lastIf = ifStmt;
        } else {
          lastIf.elseBranch = ifStmt;
          lastIf = ifStmt;
        }
      }

      return currentIf;
    }

    // Lowers a switch with genuine (non-empty-body) fall-through into a
    // sequence of `if` statements guarded by a synthetic boolean flag: once
    // a case matches (or falls through from the previous one), the flag
    // stays set so every following case's body also runs, in original JS
    // order, until one of them ends with an explicit `break` (which clears
    // the flag again) - see transformSwitchStatement's needsFallthroughLowering
    // comment for the motivating example (twofish.js's key-size switch).
    _transformSwitchWithFallthrough(discriminant, groups, fallsThrough) {
      this._switchFallthroughCounter = (this._switchFallthroughCounter || 0) + 1;
      const flagId = new PythonIdentifier(`_switch_fall_${this._switchFallthroughCounter}`);
      const statements = [new PythonAssignment(flagId, PythonLiteral.Bool(false))];

      // A `default` clause matches whenever no OTHER case's test matches,
      // regardless of where it appears among the groups (JS semantics) -
      // precompute "discriminant doesn't equal any real test" once so a
      // default group positioned mid-switch can still combine that with the
      // fallthrough flag.
      const allRealTests = [];
      for (const g of groups) if (!g.hasDefault) for (const t of g.tests) allRealTests.push(t);
      const noneMatchedCondition = () => {
        let expr = null;
        for (const t of allRealTests) {
          const test = new PythonBinaryExpression(discriminant, '!=', this.transformExpression(t));
          expr = expr ? new PythonBinaryExpression(expr, '&&', test) : test;
        }
        return expr; // null if the switch is only ever a lone `default`
      };

      for (const group of groups) {
        const caseBody = this.transformSwitchCaseBody(group.consequent);
        if (caseBody.statements.length === 0) caseBody.statements.push(new PythonPass());

        const ownTest = group.hasDefault
          ? noneMatchedCondition()
          : group.tests.reduce((cond, t) => {
              const testExpr = new PythonBinaryExpression(discriminant, '==', this.transformExpression(t));
              return cond ? new PythonBinaryExpression(cond, '||', testExpr) : testExpr;
            }, null);

        const triggerCondition = ownTest ? new PythonBinaryExpression(flagId, '||', ownTest) : flagId;

        const body = new PythonBlock();
        body.statements.push(new PythonAssignment(flagId, PythonLiteral.Bool(true)));
        body.statements.push(...caseBody.statements);
        if (!fallsThrough(group.consequent)) {
          // Trailing break/return/throw/continue: return/throw/continue
          // already exit the enclosing function/loop on their own; clearing
          // the flag after a trailing `break` stops it from also triggering
          // any later group in this same switch.
          body.statements.push(new PythonAssignment(flagId, PythonLiteral.Bool(false)));
        }

        statements.push(new PythonIf(triggerCondition, body, [], null));
      }

      return statements;
    }

    transformSwitchCaseBody(consequent) {
      const block = new PythonBlock();

      for (const stmt of consequent) {
        if (stmt.type === 'BreakStatement') {
          // Skip break statements in Python (handled by elif structure)
          continue;
        }
        const transformed = this.transformStatement(stmt);
        if (transformed) {
          if (Array.isArray(transformed)) {
            block.statements.push(...transformed);
          } else {
            block.statements.push(transformed);
          }
        }
      }

      return block;
    }

    transformThrowStatement(node) {
      let expr = this.transformExpression(node.argument);
      // Python can't raise None - convert to ValueError or re-raise
      if (!expr || (expr.nodeType === 'Literal' && expr.value === null)) {
        // Use ValueError for "throw null" patterns (authentication/tag mismatch errors)
        expr = new PythonCall(new PythonIdentifier('ValueError'), [PythonLiteral.Str('Verification failed')]);
      }
      return new PythonRaise(expr);
    }

    transformTryStatement(node) {
      const tryExcept = new PythonTryExcept();
      tryExcept.tryBlock = this.transformBlockOrStatement(node.block);

      // Python requires at least 'pass' in an empty try block. A JS try
      // body containing only runtime-module-loading code (e.g. a guarded
      // `require(...)` used to optionally load a dependency) is stripped
      // to nothing by filterModuleLoaderFunctions() upstream, which
      // otherwise left a bare `try:` with no body - a SyntaxError that
      // aborted the whole file (mirrors the existing empty-except guard
      // in transformCatchClause() just below).
      if (!tryExcept.tryBlock.statements || tryExcept.tryBlock.statements.length === 0) {
        tryExcept.tryBlock.statements = [new PythonPass()];
      }

      // Catch clauses
      if (node.handler) {
        const exceptClause = this.transformCatchClause(node.handler);
        tryExcept.exceptClauses.push(exceptClause);
      }

      // Finally block
      if (node.finalizer) {
        tryExcept.finallyBlock = this.transformBlockOrStatement(node.finalizer);
        if (!tryExcept.finallyBlock.statements || tryExcept.finallyBlock.statements.length === 0) {
          tryExcept.finallyBlock.statements = [new PythonPass()];
        }
      }

      return tryExcept;
    }

    transformCatchClause(node) {
      const exceptionType = node.param?.typeAnnotation
        ? this.mapType(node.param.typeAnnotation).name
        : 'Exception';
      const varName = node.param ? toSnakeCase(node.param.name) : null;
      const body = this.transformBlockOrStatement(node.body);

      // Python requires at least 'pass' in an empty except block
      if (!body.statements || body.statements.length === 0) {
        body.statements = [new PythonPass()];
      }

      return new PythonExceptClause(exceptionType, varName, body);
    }

    transformBlockStatement(node) {
      const block = new PythonBlock();

      // Detect sibling `let`/`const`/`var` declarations directly in THIS
      // block whose raw JS names are DIFFERENT but fold to the identical
      // Python snake_case name - e.g. hash/gost3411.js's `_fw()`: `const wS
      // = new Array(16);` and, later in the same function body, `const w_S
      // = new Array(16);`. toSnakeCase's camelCase->snake_case regex inserts
      // an underscore right before that same capital "S" either way, so
      // BOTH become `w_s` - two genuinely distinct JS locals silently
      // collapse onto one Python variable. The second declaration's `w_s =
      // [0]*16` then wipes out the first one's already-computed contents
      // before a single element of it is ever read, corrupting every
      // downstream use (here: every hash always came out all-zero, since
      // `_fw`'s output-construction loop read back nothing but freshly
      // zeroed placeholders). Disambiguate every colliding name but the
      // first with a numeric suffix - mirrors currentMethodNameOverrides'
      // identical fix for the same collision between class METHOD names -
      // for the remainder of this block only. Kept in its OWN map
      // (_localNameOverrides), separate from _identifierSubstitutions (used
      // for a narrower, unrelated purpose - see transformCallbackExpr's own
      // doc comment): merging into that shared map would let an unrelated,
      // temporarily-active callback-parameter substitution collide with (or
      // get shadowed by) a same-named local declared here.
      const prevLocalOverrides = this._localNameOverrides;
      const newOverrides = this._collectLocalNameCollisions(node.body);
      if (newOverrides.size > 0) {
        const merged = new Map(prevLocalOverrides || []);
        for (const [rawName, newName] of newOverrides) {
          merged.set(rawName, newName);
        }
        this._localNameOverrides = merged;
      }

      try {
        for (const stmt of node.body) {
          const transformed = this.transformStatement(stmt);
          if (transformed) {
            if (Array.isArray(transformed)) {
              block.statements.push(...transformed);
            } else {
              block.statements.push(transformed);
            }
          }
        }
      } finally {
        this._localNameOverrides = prevLocalOverrides;
      }

      return block;
    }

    /**
     * Scan the DIRECT-child `let`/`const`/`var` declarators of a single
     * statement list for raw JS names that fold to the same Python
     * snake_case name as an EARLIER sibling declarator's (but different)
     * raw name. Returns a Map of rawName -> disambiguated snake_case string
     * for every such later-declared colliding name (the first declarator to
     * use a given folded name keeps it unchanged). See
     * transformBlockStatement's doc comment for the concrete bug this
     * prevents. Deliberately shallow (this statement list only, not nested
     * block bodies - each nested block runs this same scan independently
     * when transformBlockStatement reaches it) to keep the analysis simple
     * and low-risk.
     */
    _collectLocalNameCollisions(statements) {
      const firstRawByFolded = new Map();
      const suffixCounters = new Map();
      const overrides = new Map();
      for (const stmt of statements || []) {
        if (!stmt || stmt.type !== 'VariableDeclaration') continue;
        for (const decl of stmt.declarations || []) {
          if (!decl || !decl.id || decl.id.type !== 'Identifier' || !decl.id.name) continue;
          const rawName = decl.id.name;
          if (this.moduleConstRenames.has(rawName)) continue;
          const folded = toSnakeCase(rawName);
          const firstRaw = firstRawByFolded.get(folded);
          if (firstRaw === undefined) {
            firstRawByFolded.set(folded, rawName);
          } else if (firstRaw !== rawName && !overrides.has(rawName)) {
            const next = (suffixCounters.get(folded) || 1) + 1;
            suffixCounters.set(folded, next);
            overrides.set(rawName, folded + '_' + next);
          }
        }
      }
      return overrides;
    }

    transformBlockOrStatement(node) {
      if (node.type === 'BlockStatement') {
        return this.transformBlockStatement(node);
      } else {
        const block = new PythonBlock();
        const stmt = this.transformStatement(node);
        if (stmt) {
          if (Array.isArray(stmt)) {
            block.statements.push(...stmt);
          } else {
            block.statements.push(stmt);
          }
        }
        return block;
      }
    }

    // ========================[ EXPRESSIONS ]========================

    transformExpression(node) {
      if (!node) return null;

      switch (node.type) {
        case 'Literal':
          return this.transformLiteral(node);
        case 'Identifier':
          return this.transformIdentifier(node);
        case 'BinaryExpression':
        case 'LogicalExpression':
          return this.transformBinaryExpression(node);
        case 'UnaryExpression':
          return this.transformUnaryExpression(node);
        case 'UpdateExpression':
          return this.transformUpdateExpression(node);
        case 'AssignmentExpression':
          return this.transformAssignmentExpression(node);
        case 'MemberExpression':
          return this.transformMemberExpression(node);
        case 'CallExpression':
          return this.transformCallExpression(node);
        case 'NewExpression':
          return this.transformNewExpression(node);
        case 'ArrayExpression':
        case 'ArrayLiteral':
          return this.transformArrayExpression(node);
        case 'ObjectExpression':
          return this.transformObjectExpression(node);
        case 'ConditionalExpression':
          return this.transformConditionalExpression(node);
        case 'ArrowFunctionExpression':
        case 'FunctionExpression':
          return this.transformLambdaExpression(node);
        case 'ThisExpression':
          return new PythonIdentifier(this._currentSelfName());
        case 'Super':
          // super in Python is super() - will be handled specially in call expression
          return new PythonIdentifier('__super__');
        case 'SequenceExpression':
          // Return the last expression
          return this.transformExpression(node.expressions[node.expressions.length - 1]);
        case 'TemplateLiteral':
          return this.transformTemplateLiteral(node);
        case 'SpreadElement':
          return this.transformSpreadElement(node);
        case 'AwaitExpression':
          return this.transformAwaitExpression(node);
        case 'ObjectPattern':
          // Object destructuring - Python doesn't support this directly
          // Return a comment placeholder
          return new PythonIdentifier('# Object destructuring not supported in Python');

        case 'StaticBlock':
          return this.transformStaticBlock(node);

        case 'ChainExpression':
          // Optional chaining a?.b - Python doesn't have this
          return this.transformExpression(node.expression);

        case 'ClassExpression':
          // Anonymous class expression - Python has lambda classes
          return this.transformClassExpression(node);

        case 'YieldExpression':
          // yield - Python has generators
          return this.transformYieldExpression(node);

        case 'PrivateIdentifier':
          // #field -> Python name-mangled private attribute with __ prefix
          return new PythonIdentifier('__' + toSnakeCase(node.name));

        // ========================[ IL AST NODE TYPES ]========================
        // These are normalized IL nodes from type-aware-transpiler.js

        case 'ParentConstructorCall':
          return this.transformParentConstructorCall(node);

        case 'ParentMethodCall':
          return this.transformParentMethodCall(node);

        case 'ThisMethodCall':
          return this.transformThisMethodCall(node);

        case 'ThisPropertyAccess':
          return this.transformThisPropertyAccess(node);

        case 'RotateLeft':
        case 'RotateRight':
          return this.transformRotation(node);

        case 'PackBytes':
          return this.transformPackBytes(node);

        case 'UnpackBytes':
          return this.transformUnpackBytes(node);

        case 'ArrayLength':
          return this.transformArrayLength(node);

        case 'ArrayAppend':
        case 'ArrayPush':
          return this.transformArrayAppend(node);

        case 'ArrayPop':
          return this.transformArrayPop(node);

        case 'ArrayShift':
          return this.transformArrayShift(node);

        case 'ArrayUnshift':
          return this.transformArrayUnshift(node);

        case 'ArraySlice':
          return this.transformArraySlice(node);

        case 'ArrayFill':
          return this.transformArrayFill(node);

        case 'ArrayXor':
          return this.transformArrayXor(node);

        case 'ArrayClear':
          return this.transformArrayClear(node);

        case 'ArrayCreation':
          return this.transformArrayCreation(node);

        case 'TypedArrayCreation':
          return this.transformTypedArrayCreation(node);

        case 'BufferCreation':
          return this.transformBufferCreation(node);

        case 'DataViewCreation':
          return this.transformDataViewCreation(node);

        case 'MapCreation':
          return this.transformMapCreation(node);

        case 'ByteBufferView':
          return this.transformByteBufferView(node);

        case 'HexDecode':
          return this.transformHexDecode(node);

        case 'HexEncode':
          return this.transformHexEncode(node);

        case 'Floor':
          return this.transformFloor(node);

        case 'Ceil':
          return this.transformCeil(node);

        case 'Abs':
          return this.transformAbs(node);

        case 'Min':
          return this.transformMin(node);

        case 'Max':
          return this.transformMax(node);

        case 'Pow':
          return this.transformPow(node);

        case 'Round':
          return this.transformRound(node);

        case 'Trunc':
          return this.transformTrunc(node);

        case 'Sign':
          return this.transformSign(node);

        case 'Sin':
          return this.transformSin(node);

        case 'Cos':
          return this.transformCos(node);

        case 'Tan':
          return this.transformTan(node);

        case 'Asin':
          return this.transformAsin(node);

        case 'Acos':
          return this.transformAcos(node);

        case 'Atan':
          return this.transformAtan(node);

        case 'Atan2':
          return this.transformAtan2(node);

        case 'Sinh':
          return this.transformSinh(node);

        case 'Cosh':
          return this.transformCosh(node);

        case 'Tanh':
          return this.transformTanh(node);

        case 'Exp':
          return this.transformExp(node);

        case 'Cbrt':
          return this.transformCbrt(node);

        case 'Hypot':
          return this.transformHypot(node);

        case 'Fround':
          return this.transformFround(node);

        case 'Random':
          return this.transformRandom(node);

        case 'Imul':
          return this.transformImul(node);

        case 'Clz32':
          return this.transformClz32(node);

        case 'Cast':
          return this.transformCast(node);

        case 'DestructuringAssignment':
          return this.transformDestructuringAssignment(node);

        // IL AST Error node
        case 'ErrorCreation': {
          // Python uses raise Exception(message) for throwing
          // For expression context, we return the exception object (caller will add raise)
          const exceptionType = node.errorType === 'TypeError' ? 'TypeError' :
                                node.errorType === 'RangeError' ? 'ValueError' :
                                'Exception';
          return new PythonCall(
            new PythonIdentifier(exceptionType),
            [node.message ? this.transformExpression(node.message) : PythonLiteral.Str('')]
          );
        }

        case 'ArrayIndexOf':
          return this.transformArrayIndexOf(node);

        case 'ArrayIncludes':
          return this.transformArrayIncludes(node);

        case 'ArrayConcat':
          return this.transformArrayConcat(node);

        case 'ArrayJoin':
          return this.transformArrayJoin(node);

        case 'ArrayReverse':
          return this.transformArrayReverse(node);

        case 'ArrayPop':
          return this.transformArrayPop(node);

        case 'ArrayShift':
          return this.transformArrayShift(node);

        case 'ArrayForEach':
          return this.transformArrayForEach(node);

        case 'ArrayMap':
          return this.transformArrayMap(node);

        case 'ArrayFilter':
          return this.transformArrayFilter(node);

        case 'ArraySome':
          return this.transformArraySome(node);

        case 'ArrayEvery':
          return this.transformArrayEvery(node);

        case 'ArrayFind':
          return this.transformArrayFind(node);

        case 'ArrayFindIndex':
          return this.transformArrayFindIndex(node);

        case 'ArrayReduce':
          return this.transformArrayReduce(node);

        case 'StringReplace':
          return this.transformStringReplace(node);

        case 'StringRepeat':
          return this.transformStringRepeat(node);

        case 'StringIndexOf':
          return this.transformStringIndexOf(node);

        case 'StringSplit':
          return this.transformStringSplit(node);

        case 'StringSubstring':
          return this.transformStringSubstring(node);

        case 'StringCharAt':
          return this.transformStringCharAt(node);

        case 'StringCharCodeAt':
          return this.transformStringCharCodeAt(node);

        case 'StringToUpperCase':
          return this.transformStringToUpperCase(node);

        case 'StringToLowerCase':
          return this.transformStringToLowerCase(node);

        case 'StringTrim':
          return this.transformStringTrim(node);

        case 'StringStartsWith':
          return this.transformStringStartsWith(node);

        case 'StringEndsWith':
          return this.transformStringEndsWith(node);

        case 'StringIncludes':
          return this.transformStringIncludes(node);

        case 'StringTransform':
          return this.transformStringTransform(node);

        case 'StringConcat':
          return this.transformStringConcat(node);

        case 'BigIntCast':
          return this.transformBigIntCast(node);

        case 'TypedArraySet':
          return this.transformTypedArraySet(node);

        case 'MapSet':
          return this.transformMapSet(node);

        case 'TypedArraySubarray':
          return this.transformTypedArraySubarray(node);

        case 'Sqrt':
          return this.transformSqrt(node);

        case 'Power':
          return this.transformPower(node);

        case 'Log2':
          return this.transformLog2(node);

        case 'MathConstant':
          return this.transformMathConstant(node);

        case 'NumberConstant':
          return this.transformNumberConstant(node);

        case 'InstanceOfCheck':
          return this.transformInstanceOfCheck(node);

        case 'ArraySort':
          return this.transformArraySort(node);

        case 'ArraySplice':
          return this.transformArraySplice(node);

        case 'SetCreation':
          return this.transformSetCreation(node);

        case 'StringToBytes': {
          // Python: string.encode('ascii') or string.encode('utf-8')
          const encoding = node.encoding || 'ascii';
          const value = node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : this.transformExpression(node.value);
          const encodingArg = encoding === 'ascii' ? PythonLiteral.Str('ascii') :
                              encoding === 'utf-8' || encoding === 'utf8' ? PythonLiteral.Str('utf-8') :
                              PythonLiteral.Str(encoding);
          return new PythonCall(new PythonMemberAccess(value, 'encode'), [encodingArg]);
        }

        case 'BytesToString': {
          // Python: bytes.decode('ascii') or bytes.decode('utf-8')
          const encoding = node.encoding || 'ascii';
          const value = node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : this.transformExpression(node.value);
          const encodingArg = encoding === 'ascii' ? PythonLiteral.Str('ascii') :
                              encoding === 'utf-8' || encoding === 'utf8' ? PythonLiteral.Str('utf-8') :
                              PythonLiteral.Str(encoding);
          // OpCodes.BytesToAnsi/BytesToAscii/BytesToUtf8 (the JS source of
          // this IL node) operate on any array-like of byte values in JS -
          // callers routinely pass a plain array literal / another
          // OpCodes call's list result, not something JS itself considers a
          // "real" byte buffer. `.decode()` only exists on Python
          // bytes/bytearray, not on a plain list (JSArray) - a caller
          // passing a list (e.g. dsa.js's signature-encoding helpers)
          // raised "'JSArray' object has no attribute 'decode'" here.
          // Wrap with bytes(...) first: a no-op copy when value is already
          // bytes/bytearray, and the correct list-of-ints -> bytes
          // conversion otherwise - one call handles every shape the JS side
          // accepts.
          return new PythonCall(new PythonMemberAccess(new PythonCall(new PythonIdentifier('bytes'), [value]), 'decode'), [encodingArg]);
        }

        // OpCodes method calls the IL parser recognized as a distinct node
        // (as opposed to a plain MemberExpression call - see transformOpCodesCall).
        // Route through the same comprehensive Python OpCodes port for every
        // method, rather than special-casing a couple and leaving the rest as
        // undefined bare function calls.
        case 'OpCodesCall': {
          const args = node.arguments.map(a => this.transformExpression(a));
          const opCodesMethod = node.method || node.name;
          return this.transformOpCodesCall(opCodesMethod, args);
        }

        // MathCall - for unhandled Math.* methods
        case 'MathCall': {
          // Math.ceil/floor/round/trunc need the TRUE floating-point
          // quotient of any `/` inside their argument - that's the entire
          // point of calling them. transformBinaryExpression's '/' handling
          // otherwise assumes a division feeding an "int context" (array
          // index, etc.) and either floor-divides (`//`, literal integer
          // divisor) or truncates via int() (variable divisor) *before*
          // rounding ever sees the value - e.g. kdf1.js's
          // `Math.ceil(outputLength / hashLen)` with a variable hashLen
          // became `math.ceil(int(output_length / hash_len))`: for 107/20
          // that's `math.ceil(int(5.35))` = `math.ceil(5)` = 5 instead of
          // the correct `math.ceil(5.35)` = 6, silently dropping the final
          // output block. Suppress both truncating fallbacks for the
          // duration of transforming this call's arguments so `/` stays a
          // genuine float division; save/restore to stay correct for
          // nested Math calls used as arguments to unrelated calls.
          const ROUNDING_METHODS = new Set(['ceil', 'floor', 'round', 'trunc']);
          const prevPreserveFloatDivision = this.preserveFloatDivision;
          if (ROUNDING_METHODS.has(node.method)) this.preserveFloatDivision = true;
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          this.preserveFloatDivision = prevPreserveFloatDivision;
          switch (node.method) {
            case 'imul':
              // Math.imul(a, b) returns a *signed* 32-bit integer product -
              // "& 0xFFFFFFFF" alone yields the unsigned low 32 bits instead.
              // That's indistinguishable from the correct value under pure
              // bitwise ops (XOR/AND/OR/shift), but any later arithmetic
              // ("+"/"-"/comparison) on the result diverges by 2^32 whenever
              // the true product's bit 31 is set (e.g. mulberry32's
              // `z + Math.imul(...)` mixing step). Route through OpCodes.ToInt
              // to reinterpret the masked product as signed, matching the
              // Perl/C# transformers' fix for the same bug.
              if (args.length >= 2)
                return new PythonCall(
                  new PythonMemberAccess(new PythonIdentifier('OpCodes'), 'ToInt'),
                  [new PythonBinaryExpression(args[0], '*', args[1])]
                );
              break;
            case 'abs':
              return new PythonCall(new PythonIdentifier('abs'), args);
            case 'floor':
              return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), 'floor'), args);
            case 'ceil':
              return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), 'ceil'), args);
            case 'round':
              return new PythonCall(new PythonIdentifier('round'), args);
            case 'min':
              return new PythonCall(new PythonIdentifier('min'), args);
            case 'max':
              return new PythonCall(new PythonIdentifier('max'), args);
            case 'pow':
              return new PythonBinaryExpression(args[0], '**', args[1]);
            case 'sqrt':
              return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), 'sqrt'), args);
            case 'log':
              return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), 'log'), args);
            case 'exp':
              return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), 'exp'), args);
            case 'sin':
              return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), 'sin'), args);
            case 'cos':
              return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), 'cos'), args);
            case 'random':
              return new PythonCall(new PythonMemberAccess(new PythonIdentifier('random'), 'random'), []);
            case 'trunc':
              return new PythonCall(new PythonIdentifier('int'), args);
            case 'sign':
              // Python doesn't have sign, use expression: (x > 0) - (x < 0)
              return new PythonBinaryExpression(
                new PythonBinaryExpression(args[0], '>', PythonLiteral.Int(0)),
                '-',
                new PythonBinaryExpression(args[0], '<', PythonLiteral.Int(0))
              );
            default:
              // Fallback to lowercase function name from math module
              return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), node.method.toLowerCase()), args);
          }
        }

        // IL AST StringInterpolation - `Hello ${name}` -> f"Hello {name}"
        case 'StringInterpolation': {
          // Build Python f-string using PythonFString AST node
          const parts = [];
          const expressions = [];
          if (node.parts) {
            for (const part of node.parts) {
              if (part.type === 'StringPart' || part.ilNodeType === 'StringPart') {
                parts.push(part.value || '');
              } else if (part.type === 'ExpressionPart' || part.ilNodeType === 'ExpressionPart') {
                if (parts.length === expressions.length) parts.push('');
                expressions.push(this.transformExpression(part.expression));
              }
            }
          } else if (node.quasis && node.expressions) {
            for (let i = 0; i < node.quasis.length; ++i) {
              parts.push(node.quasis[i] || '');
              if (i < node.expressions.length)
                expressions.push(this.transformExpression(node.expressions[i]));
            }
          }
          return new PythonFString(parts, expressions);
        }

        // IL AST ObjectLiteral - {key: value} -> {'key': value}
        case 'ObjectLiteral': {
          // Consume immediately (not read-only) so a nested object literal
          // inside one of this object's own property values doesn't also
          // pick up this same outer binding name - see the doc comment on
          // _pendingObjLiteralSelfName's producer in transformVariableDeclaration.
          const objSelfName = this._pendingObjLiteralSelfName;
          this._pendingObjLiteralSelfName = null;

          if (!node.properties || node.properties.length === 0)
            return new PythonDict([]);

          const entries = [];
          const spreads = [];
          // Accumulated separately from this.pendingPreStatements: transforming
          // a *later* property (e.g. its own nested call/assignment expressions)
          // can reset that shared buffer as scratch state for its own unrelated
          // purposes, silently discarding any hoisted function defs an
          // *earlier* property in this same object literal already queued
          // there. Collect locally and splice into pendingPreStatements only
          // once, right before returning, after every property has been
          // transformed and can no longer clobber it.
          const hoistedFnDefs = [];

          // See _computeJsonPreserveKeyLiterals's doc comment: this
          // particular ObjectLiteral node was found, by the light
          // cross-method dataflow trace run once up front in
          // transformProgram, to eventually flow into a JSON.stringify(...)
          // call several hops away (a returned value assigned to a variable,
          // threaded through another method's parameter, ...) - unlike the
          // 'JsonSerialize' case's `_preserveJsonObjectKeys` counter, which
          // only catches an object literal written DIRECTLY inside the
          // JSON.stringify(...) argument. The dict keys themselves must stay
          // snake_cased below (every OTHER reader of this same object -
          // e.g. a destructuring assignment elsewhere - looks it up by the
          // snake_cased name), so record snake->original pairs here and
          // restore the original spelling only at the actual json.dumps()
          // boundary (see the wrapping `_json_preserve()` call below and its
          // HELPER_STUBS doc comment).
          const jsonAliases = (this._jsonPreserveKeyLiterals && this._jsonPreserveKeyLiterals.has(node)) ? {} : null;

          // Pre-scan get/set accessor properties (mirrors the identical
          // handling in transformObjectExpression for the raw-ESTree
          // 'ObjectExpression' node shape - see its doc comment) so both
          // halves of a `set key(v){...}` / `get key(){...}` pair collapse
          // into one `_JSAccessor(fget=..., fset=...)` entry instead of the
          // second clobbering the first in the dict literal.
          const accessorGroups = new Map();
          for (const prop of node.properties) {
            if (prop.type === 'ObjectSpread' || prop.type === 'SpreadElement') continue;
            if (prop.kind !== 'get' && prop.kind !== 'set') continue;
            if (prop.computed || typeof prop.key !== 'string') continue;
            const snakeKey = prop.keyIsLiteral ? prop.key : toSnakeCaseProperty(prop.key);
            let group = accessorGroups.get(snakeKey);
            if (!group) { group = {}; accessorGroups.set(snakeKey, group); }
            if (prop.kind === 'get') group.getProp = prop; else group.setProp = prop;
          }
          const accessorEmitted = new Set();

          for (const prop of node.properties) {
            // The IL parser emits 'ObjectSpread' for {...obj} inside an object
            // literal (see _transformObjectExpression in type-aware-transpiler.js);
            // 'SpreadElement' is the array-spread node type, not this one. Treating
            // ObjectSpread like a normal key/value property left a bogus
            // {"key": <empty>} entry (prop.key/.value don't exist on it - only
            // .argument does) that produced invalid Python syntax.
            if (prop.type === 'ObjectSpread' || prop.type === 'SpreadElement') {
              spreads.push(this.transformExpression(prop.argument));
              continue;
            }
            if ((prop.kind === 'get' || prop.kind === 'set') && !prop.computed && typeof prop.key === 'string') {
              const snakeKey = prop.keyIsLiteral ? prop.key : toSnakeCaseProperty(prop.key);
              if (accessorEmitted.has(snakeKey)) continue;
              accessorEmitted.add(snakeKey);
              const group = accessorGroups.get(snakeKey);
              const buildAccessorFn = (accessorProp, kindLabel) => {
                if (!accessorProp) return new PythonIdentifier('None');
                this._objFnCounter = (this._objFnCounter || 0) + 1;
                const helperName = '_objfn_' + toSnakeCase(snakeKey) + '_' + kindLabel + '_' + this._objFnCounter;
                if (objSelfName) this._objSelfNameStack.push(objSelfName);
                let funcDef;
                try {
                  funcDef = this.transformArrowToFunction(helperName, accessorProp.value);
                } finally {
                  if (objSelfName) this._objSelfNameStack.pop();
                }
                hoistedFnDefs.push(funcDef);
                return new PythonIdentifier(helperName);
              };
              const fget = buildAccessorFn(group.getProp, 'get');
              const fset = buildAccessorFn(group.setProp, 'set');
              const value = new PythonCall(new PythonIdentifier('_JSAccessor'), [], [
                { name: 'fget', value: fget },
                { name: 'fset', value: fset }
              ]);
              entries.push({ key: PythonLiteral.Str(snakeKey), value });
              continue;
            }
            const rawKey = prop.key?.name || prop.key?.value || prop.key || 'key';
            // Object literals are always wrapped in JSObject for JS-style dot
            // access (see PythonDict/emitDict). Dot access snake_cases the
            // property name (transformMemberExpression), so the stored key
            // must match or attribute lookups like obj.T0 (accessed as
            // obj.t0) fail with AttributeError.
            //
            // However, keys written as quoted string literals in the source
            // (e.g. {'SHA1': ...}) are frequently exact-case lookup tables
            // matched against runtime strings (hash/algorithm/mode names)
            // rather than dot-accessed attributes - case-folding those breaks
            // the lookup. Only bare-identifier keys get snake_cased.
            //
            // A NUMERIC literal key written with a non-decimal prefix (e.g.
            // ecc/bicycle-code.js's `{ 0b00: [...], 0b01: [...], ... }`
            // logical-state lookup table) reaches here as `prop.keyIsLiteral`
            // with `rawKey` holding the literal's ORIGINAL SOURCE spelling
            // ("0b00") rather than its numeric value - the shared parser's
            // property-key normalization keeps whatever text was written,
            // it doesn't evaluate numeric literals the way JS's own
            // ToPropertyKey does (any numeric key becomes the decimal string
            // of its VALUE, "0" - never "0b00"). Every real lookup
            // (`table[state]`, state a computed int) goes through
            // JSObject._k(), which DOES convert an int key to its decimal
            // string - so an unevaluated "0b00" text key is never found by
            // any actual access, silently returning None instead.
            const numericKeyMatch = typeof rawKey === 'string' && prop.keyIsLiteral &&
              /^0[bBoOxX][0-9a-fA-F]+$/.test(rawKey);
            // Inside a JSON.stringify(...) argument (see the 'JsonSerialize'
            // case's `_preserveJsonObjectKeys` setter), keep the RAW JS
            // property spelling instead of snake_casing it - the resulting
            // JSON text is externally-visible byte data (e.g. compared
            // byte-for-byte against a hardcoded test vector recorded from the
            // real JS's own camelCase output, as in
            // compression/deflate-simple.js's `_packCompressedData` encoding
            // `huffmanResult`/`originalLength`), not a Python identifier -
            // "matches Python style" is the wrong goal for a key that's
            // actually serialized data.
            const key = (typeof rawKey === 'string' && !prop.keyIsLiteral)
              ? (this._preserveJsonObjectKeys ? rawKey : toSnakeCaseProperty(rawKey))
              : numericKeyMatch ? String(Number(rawKey))
              : rawKey;
            if (jsonAliases && typeof rawKey === 'string' && key !== rawKey) jsonAliases[key] = rawKey;
            let value;
            if ((prop.value?.type === 'FunctionExpression' || prop.value?.type === 'ArrowFunctionExpression' || prop.value?.type === 'ArrowFunction') &&
                prop.value.body && prop.value.body.type === 'BlockStatement') {
              // Legacy `const X = { method: function(a, b) { ...; return c; } }`
              // namespace-object pattern (a stand-in for a real class - see
              // e.g. NumberTheory in rabin.js, or the various algorithm
              // "objects" the Perl transpiler had the same problem with).
              // this.transformExpression(prop.value) would route through
              // the generic FunctionExpression case (transformLambdaExpression),
              // which keeps only the *first* statement of a block body -
              // Python lambdas are single-expression only - silently
              // degrading every multi-statement/loop-bearing method into
              // `lambda *a: None` (every call through the dict then returns
              // None, corrupting everything downstream that relies on it).
              // Hoist a real named function next to the dict literal instead
              // and reference it by name.
              const propKeyName = typeof rawKey === 'string' ? rawKey : 'fn';
              this._objFnCounter = (this._objFnCounter || 0) + 1;
              const helperName = '_objfn_' + toSnakeCase(propKeyName) + '_' + this._objFnCounter;
              if (objSelfName) this._objSelfNameStack.push(objSelfName);
              let funcDef;
              try {
                funcDef = this.transformArrowToFunction(helperName, prop.value);
              } finally {
                if (objSelfName) this._objSelfNameStack.pop();
              }
              hoistedFnDefs.push(funcDef);
              value = new PythonIdentifier(helperName);
            } else if (prop.value && (prop.value.type === 'UpdateExpression' ||
                       (prop.value.type === 'UnaryExpression' && (prop.value.operator === '++' || prop.value.operator === '--')))) {
              // `{ code: firstCode[len]++ }` - Python has no ++/-- expression
              // form, so a bare `this.transformExpression(prop.value)` below
              // would hit transformUpdateExpression(), which returns a
              // PythonAssignment *statement* node (`first_code[len_] += 1`)
              // as the property "value" - PythonDict just stringifies
              // whatever it's given, so that assignment statement's own text
              // landed verbatim inside the dict literal (a SyntaxError: dict
              // values can't contain a bare statement). Hoist the increment
              // as its own statement (matching the sibling handling in
              // transformObjectExpression() for the 'ObjectExpression' node
              // shape) and use the pre/post-increment value as the entry.
              const target = this.transformExpression(prop.value.argument);
              const one = PythonLiteral.Int(1);
              const op = prop.value.operator === '++' ? '+=' : '-=';
              const updateStmt = new PythonAssignment(target, one);
              updateStmt.operator = op;
              updateStmt.isAugmented = true;
              if (prop.value.prefix) {
                if (!this.pendingPreStatements) this.pendingPreStatements = [];
                this.pendingPreStatements.push(updateStmt);
                value = this.transformExpression(prop.value.argument);
              } else {
                if (!this.pendingPostStatements) this.pendingPostStatements = [];
                this.pendingPostStatements.push(updateStmt);
                value = this.transformExpression(prop.value.argument);
              }
            } else {
              value = this.transformExpression(prop.value);
            }
            entries.push({ key: PythonLiteral.Str(key), value: value });
          }
          if (hoistedFnDefs.length > 0) {
            if (!this.pendingPreStatements) this.pendingPreStatements = [];
            this.pendingPreStatements.push(...hoistedFnDefs);
          }
          const dict = new PythonDict(entries);
          if (spreads.length > 0) dict.spreads = spreads;
          if (jsonAliases && Object.keys(jsonAliases).length > 0) {
            const aliasEntries = Object.entries(jsonAliases).map(([snakeKey, origKey]) =>
              ({ key: PythonLiteral.Str(snakeKey), value: PythonLiteral.Str(origKey) }));
            return new PythonCall(new PythonIdentifier('_json_preserve'), [dict, new PythonDict(aliasEntries, false)]);
          }
          return dict;
        }

        // IL AST StringFromCharCodes - String.fromCharCode(65) -> chr(65)
        case 'StringFromCharCodes': {
          const rawCodes = node.charCodes || node.arguments || [];
          // String.fromCharCode(...array) -> ''.join(chr(c) for c in array)
          if (rawCodes.length === 1 && rawCodes[0].type === 'SpreadElement') {
            const spreadArg = this.transformExpression(rawCodes[0].argument);
            return new PythonCall(
              new PythonMemberAccess(PythonLiteral.Str(''), 'join'),
              [new PythonGeneratorExpression(
                new PythonCall(new PythonIdentifier('chr'), [new PythonIdentifier('_c')]),
                new PythonIdentifier('_c'),
                spreadArg
              )]
            );
          }
          const args = rawCodes.map(a => this.transformExpression(a));
          if (args.length === 0)
            return PythonLiteral.Str('');
          if (args.length === 1)
            return new PythonCall(new PythonIdentifier('chr'), args);
          // Multiple chars: ''.join([chr(c) for c in [c1, c2, ...]])
          return new PythonCall(
            new PythonMemberAccess(PythonLiteral.Str(''), 'join'),
            [new PythonListComprehension(
              new PythonCall(new PythonIdentifier('chr'), [new PythonIdentifier('c')]),
              new PythonIdentifier('c'),
              new PythonList(args)
            )]
          );
        }

        // IL AST IsArrayCheck - Array.isArray(x) -> isinstance(x, (list, bytes, bytearray))
        // NOT just `list`: this codebase's Python runtime routinely
        // represents a JS byte array as `bytes`/`bytearray` rather than
        // `list` (hex-literal test-vector fields decode to `bytes` -
        // see the shared test harness's _as_bytes() -, `new Uint8Array(...)`
        // becomes `bytearray(...)`, OpCodes helpers frequently return
        // `bytes`). A guard like `if (!Array.isArray(keyBytes)) throw ...`
        // (dstu7624mac.js's key setter, and 236 other algorithm files) is
        // meant to reject non-array-like input (strings, dicts, None) - not
        // a `bytes`/`bytearray` value carrying the exact same byte
        // sequence a `list` of ints would. Narrowing to `list` alone made
        // every such guard reject legitimate `bytes` key/data input,
        // silently aborting setup (the exception is routinely swallowed by
        // the generic test-harness property-setter fallback) and surfacing
        // later as a confusing "instance not initialized" / empty-output
        // failure far from the real cause.
        case 'IsArrayCheck': {
          const value = this.transformExpression(node.value);
          return new PythonCall(new PythonIdentifier('isinstance'), [value, new PythonTuple([
            new PythonIdentifier('list'), new PythonIdentifier('bytes'), new PythonIdentifier('bytearray')
          ])]);
        }

        // IL AST ArrowFunction - (x) => expr -> lambda x: expr
        case 'ArrowFunction': {
          const params = (node.params || []).map((p, idx) => {
            // toSnakeCase() (not a bare pass-through) everywhere below - it
            // also escapePythonReserved()s the result, matching how the
            // lambda body's own references to this same parameter get
            // transformed (transformIdentifier's fallback). Without it, a
            // param literally named `from`/`import`/... (valid in JS, a
            // Python keyword) rendered unescaped straight into the
            // parameter list - `lambda x, from, to: ...` - a SyntaxError,
            // even though every reference to it *inside* the lambda body
            // correctly became `from_`.
            if (typeof p === 'string') return new PythonIdentifier(toSnakeCase(p));
            // Default-valued parameter: either a normalized DefaultParameter
            // IL node (`.name`/`.defaultValue`, set by type-aware-transpiler's
            // _transformFunctionExpression) or, when this parse path leaves
            // the parameter list in its raw shape, an AssignmentExpression
            // (`.left.name` / `.right`) - `(code = 0) => ...` parses to an
            // AssignmentExpression param here, not an AssignmentPattern.
            // Falling through to the bare `p.name || 'arg'` fallback for
            // these (as before) left every defaulted param nameless, so
            // `(node, code = 0, length = 0) => {...}` produced
            // `lambda node, arg, arg: ...` - a SyntaxError (duplicate
            // argument), and even with unique fallback names would still
            // NameError on every reference to `code`/`length` in the body.
            if (p.type === 'DefaultParameter' || (p.type === 'AssignmentExpression' && p.left)) {
              const pname = toSnakeCase(p.name || (p.left && p.left.name) || `arg${idx}`);
              const defaultNode = p.defaultValue || p.right;
              let defaultText = '0';
              if (defaultNode) {
                try { defaultText = String(this.transformExpression(defaultNode)); } catch (e) { /* keep fallback */ }
              }
              // PythonLambda has no dedicated default-value slot - it joins
              // each parameter's `.name` verbatim (see PythonLambda.toString
              // in PythonAST.js) - embed the `name=default` text directly.
              return new PythonIdentifier(`${pname}=${defaultText}`);
            }
            const name = toSnakeCase(p.name || `arg${idx}`);
            return new PythonIdentifier(name);
          });
          let body;
          if (node.body) {
            if (node.body.type === 'BlockStatement') {
              // Python lambdas are single-expression only; for blocks, use a nested def
              // For now, just use the last expression if available
              const stmts = node.body.body || [];
              const lastStmt = stmts[stmts.length - 1];
              if (lastStmt && lastStmt.type === 'ReturnStatement' && lastStmt.argument) {
                body = this.transformExpression(lastStmt.argument);
              } else {
                body = PythonLiteral.None();
              }
            } else {
              body = this.transformExpression(node.body);
            }
          } else {
            body = PythonLiteral.None();
          }
          return new PythonLambda(params, body);
        }

        // IL AST TypeOfExpression - typeof x -> type(x).__name__
        case 'TypeOfExpression': {
          // Field is 'argument' (matches UnaryExpression), not 'value'.
          const argNode = node.argument || node.value;
          // See UNDECLARABLE_JS_GLOBALS: `typeof <browser/worker-only
          // pseudo-global>` is a common feature-detection guard (env
          // lookup boilerplate) that must resolve to the literal string
          // "undefined" - the identifier itself is never declared in the
          // Python output, so evaluating it via type(x) crashes with
          // NameError before the comparison this typeof feeds even runs.
          if (argNode && argNode.type === 'Identifier' &&
              PythonTransformer.UNDECLARABLE_JS_GLOBALS.has(argNode.name)) {
            return PythonLiteral.Str('undefined');
          }
          const value = this.transformExpression(argNode);
          return new PythonMemberAccess(
            new PythonCall(new PythonIdentifier('type'), [value]),
            '__name__'
          );
        }

        // IL AST Power - x ** y -> x ** y
        case 'Power': {
          const left = this.transformExpression(node.left);
          const right = this.transformExpression(node.right);
          return new PythonBinaryExpression(left, '**', right);
        }

        // IL AST ObjectFreeze - Object.freeze(x) -> just return x (no-op in Python)
        case 'ObjectFreeze': {
          // IL node uses 'object' property, not 'value'
          return this.transformExpression(node.object || node.value);
        }

        // IL AST ArrayFrom - Array.from(x) -> list(x) or [*x]
        case 'ArrayFrom': {
          // Array.from({ length: N }, fn) is a common array-like pattern for
          // building fixed-size arrays; {length:N} isn't iterable in Python so
          // translate it to range(N) instead of iterating a dict/JSObject.
          const iterableIL = node.iterable;
          const isLengthObject = iterableIL && iterableIL.type === 'ObjectLiteral' &&
            Array.isArray(iterableIL.properties) && iterableIL.properties.length === 1 &&
            iterableIL.properties[0].type === 'ObjectProperty' && iterableIL.properties[0].key === 'length';

          const iterVar = new PythonIdentifier('_x');
          const iterable = isLengthObject
            ? new PythonCall(new PythonIdentifier('range'), [this.transformExpression(iterableIL.properties[0].value)])
            : this.transformExpression(iterableIL);

          if (node.mapFunction) {
            // Array.from(arr, fn) -> [fn(x) for x in arr]
            // Only pass as many arguments as the map function actually declares
            // (Array.from callbacks receive (element, index) but many map
            // functions ignore both, e.g. () => new Uint32Array(256)).
            const declaredParams = node.mapFunction.params ? node.mapFunction.params.length : 1;
            const mapFn = this.transformExpression(node.mapFunction);
            const callArgs = [];
            if (declaredParams >= 1) callArgs.push(iterVar);
            if (declaredParams >= 2) callArgs.push(iterVar); // index === element when iterating range()
            return new PythonListComprehension(
              new PythonCall(mapFn, callArgs),
              iterVar,
              iterable
            );
          }
          return new PythonCall(new PythonIdentifier('list'), [iterable]);
        }

        // IL AST ObjectKeys - Object.keys(obj) -> _js_object_keys(obj) (see
        // its HELPER_STUBS doc comment: NOT plain obj.keys() - a JS
        // object's enumeration order sorts integer-like keys ascending
        // ahead of everything else, which a Python dict's pure insertion
        // order doesn't reproduce on its own).
        case 'ObjectKeys': {
          const obj = this.transformExpression(node.object);
          return new PythonCall(new PythonIdentifier('_js_object_keys'), [obj]);
        }

        // IL AST ObjectValues - Object.values(obj) -> _js_object_values(obj)
        case 'ObjectValues': {
          const obj = this.transformExpression(node.object);
          return new PythonCall(new PythonIdentifier('_js_object_values'), [obj]);
        }

        // IL AST ObjectEntries - Object.entries(obj) -> _js_object_entries(obj)
        case 'ObjectEntries': {
          const obj = this.transformExpression(node.object);
          return new PythonCall(new PythonIdentifier('_js_object_entries'), [obj]);
        }

        // IL AST ObjectCreate - Object.create(proto) -> JSObject(dict(proto)) or copy
        // (a flat-copy approximation of JS's real prototype-chain inheritance -
        // ObjectCreate's dotted-lookup callers can't tell the difference, and
        // the codebase's actual uses are all the `_cipher: Object.create(MUGI)`
        // "clone the module object for a fresh mutable instance" idiom, not
        // genuine prototype delegation). Must stay a JSObject, not a bare
        // dict() - callers immediately do attribute access on the result
        // (`instance._cipher.KeySetup(...)`), which a plain Python dict
        // doesn't support ('dict' object has no attribute 'key_setup').
        case 'ObjectCreate': {
          const proto = this.transformExpression(node.prototype);
          if (node.properties) {
            // Object.create(proto, properties) - merge dicts
            return new PythonCall(new PythonIdentifier('JSObject'), [
              new PythonBinaryOp(
                new PythonCall(new PythonIdentifier('dict'), [proto]),
                '|',
                this.transformExpression(node.properties)
              )
            ]);
          }
          return new PythonCall(new PythonIdentifier('JSObject'), [
            new PythonCall(new PythonIdentifier('dict'), [proto])
          ]);
        }

        // IL AST IsIntegerCheck - Number.isInteger(x) -> isinstance(x, int)
        case 'IsIntegerCheck': {
          const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          return new PythonCall(new PythonIdentifier('isinstance'), [value, new PythonIdentifier('int')]);
        }

        // IL AST DebugOutput - console.log/warn/error -> print()
        case 'DebugOutput': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new PythonCall(new PythonIdentifier('print'), args);
        }

        // IL AST DataViewWrite - view.setUint32(offset, value, le) -> struct.pack_into
        case 'DataViewWrite': {
          const view = this.transformExpression(node.view);
          const offset = this.transformExpression(node.offset);
          const value = this.transformExpression(node.value);
          const method = node.method;
          // `node.littleEndian` is the RAW argument-expression node (usually
          // a `Literal`, e.g. `{type: 'Literal', value: false}` for
          // aead/deoxys-ii.js's `counter.setBigUint64(0, BigInt(index),
          // false)`), not an already-evaluated boolean - comparing the whole
          // node object `!== false` is comparing an object to a primitive,
          // which is unconditionally true regardless of the argument's
          // actual value, so this always came out little-endian even for a
          // call that explicitly passed `false` requesting big-endian (only
          // ever "working" by coincidence for the sibling call sites that
          // happen to want littleEndian=true, e.g. hash/lsh.js's
          // getBigUint64(..., true) - and silently writing the DEFLATE
          // tweak-block counter in the wrong byte order here, corrupting
          // every AAD/message block after the first). Read the literal's
          // actual `.value`; omitted (node.littleEndian is undefined/null,
          // no third argument in the original JS call) correctly defaults
          // to big-endian, matching DataView's real ECMAScript default.
          const littleEndian = !!(node.littleEndian && node.littleEndian.type === 'Literal' && node.littleEndian.value === true);

          // Python struct format codes
          let fmt = littleEndian ? '<' : '>';
          if (method.includes('BigUint64')) fmt += 'Q';
          else if (method.includes('BigInt64')) fmt += 'q';
          else if (method.includes('Float64')) fmt += 'd';
          else if (method.includes('Float32')) fmt += 'f';
          else if (method.includes('Uint32')) fmt += 'I';
          else if (method.includes('Uint16')) fmt += 'H';
          else if (method === 'setUint8') fmt += 'B';
          else if (method.includes('Int32')) fmt += 'i';
          else if (method.includes('Int16')) fmt += 'h';
          else if (method.includes('Int8')) fmt += 'b';
          else fmt += 'I';

          this.imports.add('struct');
          return new PythonCall(
            new PythonMemberAccess(new PythonIdentifier('struct'), 'pack_into'),
            [PythonLiteral.Str(fmt), view, offset, value]
          );
        }

        // IL AST DataViewRead - view.getUint32(offset, le) -> struct.unpack_from
        case 'DataViewRead': {
          const view = this.transformExpression(node.view);
          const offset = this.transformExpression(node.offset);
          const method = node.method;
          // See the matching 'DataViewWrite' case's doc comment just above -
          // `node.littleEndian` is the raw argument node, not a boolean.
          const littleEndian = !!(node.littleEndian && node.littleEndian.type === 'Literal' && node.littleEndian.value === true);

          if (method === 'getUint8')
            return new PythonSubscript(view, offset);

          // Python struct format codes
          let fmt = littleEndian ? '<' : '>';
          if (method.includes('BigUint64')) fmt += 'Q';
          else if (method.includes('BigInt64')) fmt += 'q';
          else if (method.includes('Float64')) fmt += 'd';
          else if (method.includes('Float32')) fmt += 'f';
          else if (method.includes('Uint32')) fmt += 'I';
          else if (method.includes('Uint16')) fmt += 'H';
          else if (method.includes('Int32')) fmt += 'i';
          else if (method.includes('Int16')) fmt += 'h';
          else if (method.includes('Int8')) fmt += 'b';
          else fmt += 'I';

          this.imports.add('struct');
          return new PythonSubscript(
            new PythonCall(
              new PythonMemberAccess(new PythonIdentifier('struct'), 'unpack_from'),
              [PythonLiteral.Str(fmt), view, offset]
            ),
            PythonLiteral.Int(0)
          );
        }

        // IL AST StringCharCodeAt - str.charCodeAt(i) -> ord(str[i])
        case 'StringCharCodeAt': {
          const str = this.transformExpression(node.string);
          const index = this.transformExpression(node.index);
          return new PythonCall(new PythonIdentifier('ord'), [new PythonSubscript(str, index)]);
        }

        // IL AST StringReplace - str.replace(search, replace) -> str.replace(search, replace)
        case 'StringReplace': {
          const str = this.transformExpression(node.string);
          const search = this.transformExpression(node.searchValue);
          const replace = this.transformExpression(node.replaceValue);
          return new PythonCall(new PythonMemberAccess(str, 'replace'), [search, replace]);
        }

        // IL AST BufferCreation - new ArrayBuffer(n) -> JSUint8Array(n)
        // (see the JSUint8Array HELPER_STUBS entry - masks stores to 8
        // bits like a real Uint8Array/ArrayBuffer byte view does).
        case 'BufferCreation': {
          const size = this.transformExpression(node.size);
          return new PythonCall(new PythonIdentifier('JSUint8Array'), [size]);
        }

        // IL AST MathCall - Math.imul(a,b) or other Math methods (duplicate case - see above)
        // This case is handled above in the MathCall section

        // IL AST TypedArraySubarray - arr.subarray(start, end) -> arr[start:end]
        case 'TypedArraySubarray': {
          const array = this.transformExpression(node.array);
          const start = this.transformExpression(node.start);
          const end = node.end ? this.transformExpression(node.end) : null;

          return new PythonSlice(array, start, end);
        }

        // IL AST Log - Math.log(x) -> math.log(x)
        case 'Log': {
          const arg = this.transformExpression(node.argument);
          this.imports.add('math');
          return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), 'log'), [arg]);
        }

        // IL AST DeleteExpression - delete obj.prop / delete obj[key] -> del obj.prop / del obj[key]
        case 'DeleteExpression': {
          const target = this.transformExpression(node.argument);
          return new PythonDelete(target);
        }

        // IL AST JsonSerialize - JSON.stringify(x) -> json.dumps(x)
        case 'JsonSerialize': {
          // Any object literal inside `node.value` (at any nesting depth)
          // must keep its RAW JS property spelling rather than the usual
          // snake_case conversion - the resulting JSON text is externally
          // visible byte data (e.g. compared byte-for-byte against a
          // hardcoded test vector recorded from the real JS's own camelCase
          // output, as in compression/deflate-simple.js's
          // `_packCompressedData` encoding `huffmanResult`/
          // `originalLength`), not a Python identifier - see
          // transformObjectExpression's matching doc comment for the actual
          // key-selection logic this flag gates.
          this._preserveJsonObjectKeys = (this._preserveJsonObjectKeys || 0) + 1;
          let value;
          try {
            value = this.transformExpression(node.value);
          } finally {
            this._preserveJsonObjectKeys--;
          }
          this.imports.add('json');
          // JS's JSON.stringify(x) (no 3rd `space` argument) has no
          // whitespace between tokens; Python's json.dumps defaults to
          // ", "/": " separators, which would corrupt an exact-string
          // comparison against a real JS-produced value (e.g. a golden
          // test vector) even when the underlying data is identical.
          return new PythonCall(new PythonMemberAccess(new PythonIdentifier('json'), 'dumps'), [value],
            [
              { name: 'default', value: new PythonIdentifier('_json_default') },
              { name: 'separators', value: new PythonTuple([PythonLiteral.Str(','), PythonLiteral.Str(':')]) }
            ]);
        }

        // IL AST JsonDeserialize - JSON.parse(x) -> json.loads(x)
        // Special-cases the common JSON.parse(JSON.stringify(x)) deep-clone idiom -> copy.deepcopy(x)
        case 'JsonDeserialize': {
          if (node.text && node.text.type === 'JsonSerialize') {
            const inner = this.transformExpression(node.text.value);
            this.imports.add('copy');
            return new PythonCall(new PythonMemberAccess(new PythonIdentifier('copy'), 'deepcopy'), [inner]);
          }
          const text = this.transformExpression(node.text);
          this.imports.add('json');
          return new PythonCall(new PythonMemberAccess(new PythonIdentifier('json'), 'loads'), [text]);
        }

        // IL AST ObjectMerge - Object.assign(target, ...sources) -> {**target, **source1, ...}
        case 'ObjectMerge': {
          const target = this.transformExpression(node.target);
          const sources = (node.sources || []).map(s => this.transformExpression(s));
          const dict = new PythonDict([]);
          dict.spreads = [target, ...sources];
          return dict;
        }

        // IL AST ObjectFromEntries - Object.fromEntries(entries) -> dict(entries)
        case 'ObjectFromEntries': {
          const entries = this.transformExpression(node.entries);
          return new PythonCall(new PythonIdentifier('dict'), [entries]);
        }

        default:
          // Log warning for unhandled expression types to aid debugging
          this.warnings.push(`Unsupported expression type: ${node.type}`);
          const safeStringify = (obj) => {
            try {
              return JSON.stringify(obj, (_, v) => typeof v === 'bigint' ? v.toString() + 'n' : v, 2).substring(0, 200);
            } catch (e) { return '[stringify error]'; }
          };
          console.warn(`[PythonTransformer] Unhandled expression type: ${node.type}`, safeStringify(node));
          // Return a placeholder that will cause parse errors with clear indication
          return new PythonIdentifier(`UNHANDLED_EXPRESSION_${node.type}`);
      }
    }

    /**
     * Transform SpreadElement (e.g., ...array)
     * Python equivalent: *array (unpacking)
     */
    transformSpreadElement(node) {
      const argument = this.transformExpression(node.argument);
      // Create a special spread marker that the emitter can handle
      // Python uses *x for unpacking in function calls and [*x] for array unpacking
      return new PythonUnaryExpression('*', argument);
    }

    /**
     * Transform await expression
     * Python: await expression
     */
    transformAwaitExpression(node) {
      const argument = this.transformExpression(node.argument);
      return new PythonUnaryExpression('await', argument);
    }

    transformLiteral(node) {
      if (node.value === null) {
        return PythonLiteral.None();
      }
      // Handle undefined - treat same as None in Python
      if (node.value === undefined) {
        return PythonLiteral.None();
      }
      // Handle regex literals - convert to Python re.compile()
      if (node.regex) {
        const pattern = node.regex.pattern;
        const flags = node.regex.flags || '';
        // Create re.compile(r'pattern') call
        // Convert JS regex flags to Python re flags
        const pyFlags = [];
        if (flags.includes('i')) pyFlags.push('re.IGNORECASE');
        if (flags.includes('m')) pyFlags.push('re.MULTILINE');
        if (flags.includes('s')) pyFlags.push('re.DOTALL');

        const args = [PythonLiteral.Str(pattern, true)]; // true for raw string
        if (pyFlags.length > 0) {
          args.push(new PythonIdentifier(pyFlags.join(' | ')));
        }
        this.imports.add('re');
        return new PythonCall(
          new PythonMemberAccess(new PythonIdentifier('re'), 'compile'),
          args
        );
      }
      if (typeof node.value === 'boolean') {
        return PythonLiteral.Bool(node.value);
      }
      if (typeof node.value === 'number') {
        if (Number.isInteger(node.value)) {
          return PythonLiteral.Int(node.value);
        }
        return PythonLiteral.Float(node.value);
      }
      if (typeof node.value === 'string') {
        return PythonLiteral.Str(node.value);
      }
      // Handle BigInt - Python int() supports arbitrary precision
      if (typeof node.value === 'bigint' || node.bigint) {
        const bigValue = typeof node.value === 'bigint' ? node.value : BigInt(node.bigint.slice(0, -1));
        // Use BigInt's toString() to preserve full precision - don't use Number() which overflows
        const strValue = bigValue.toString();
        // Return as Python int literal (Python handles arbitrary precision natively)
        return new PythonLiteral(strValue, 'int');
      }
      return PythonLiteral.None();
    }

    transformIdentifier(node) {
      // Convert special identifiers
      const name = node.name;

      // Active only while transforming an expression-bodied Array-callback
      // (see transformCallbackExpr) whose 3rd ("array") parameter is
      // referenced - that parameter must resolve to the SAME array
      // expression being iterated (e.g. classical/foursquare.js's
      // `.filter((char, index, arr) => arr.indexOf(char) === index)`)
      // rather than a loop variable of its own (there is nothing to bind
      // it to across enumerate() iterations - it's the same array every
      // time), so it's substituted by raw JS name instead of going through
      // ordinary identifier resolution below.
      if (this._identifierSubstitutions && this._identifierSubstitutions.has(name)) {
        return this._identifierSubstitutions.get(name);
      }

      // A same-block sibling declaration whose raw name collides with an
      // earlier one only after snake-casing (e.g. `wS` vs `w_S` - see
      // transformBlockStatement's _collectLocalNameCollisions doc comment)
      // was renamed at its declaration site; every later read of that same
      // raw JS name must resolve to the identical renamed Python identifier.
      if (this._localNameOverrides && this._localNameOverrides.has(name)) {
        return new PythonIdentifier(this._localNameOverrides.get(name));
      }

      if (name === 'undefined' || name === 'null') {
        return PythonLiteral.None();
      }
      if (name === 'true') {
        return PythonLiteral.Bool(true);
      }
      if (name === 'false') {
        return PythonLiteral.Bool(false);
      }
      // JavaScript Infinity -> Python float('inf')
      if (name === 'Infinity') {
        return new PythonCall(new PythonIdentifier('float'), [PythonLiteral.Str('inf')]);
      }
      // JavaScript NaN -> Python float('nan')
      if (name === 'NaN') {
        return new PythonCall(new PythonIdentifier('float'), [PythonLiteral.Str('nan')]);
      }

      // Constant-table names (K, H, IV, SBOX, ...) resolve to their
      // per-file-unique renamed form - see moduleConstRenames in
      // transformProgram() and the matching declaration-side rename in
      // transformVariableDeclaration().
      if (this.moduleConstRenames.has(name)) {
        return new PythonIdentifier(this.moduleConstRenames.get(name));
      }

      // Preserve PascalCase class names that we've seen defined
      // e.g., SNOW3GAlgorithm, AESInstance, HashFunctionAlgorithm
      if (this.definedClassNames.has(name)) {
        // This is a class name - preserve it
        return new PythonIdentifier(escapePythonReserved(name));
      }

      // Also preserve framework base class names. Reuse the same
      // FRAMEWORK_ALGORITHM_BASES/FRAMEWORK_INSTANCE_BASES lists
      // generateFrameworkStubs()/transformMemberExpression() stub and
      // recognize (see their shared doc comment above) rather than a
      // separately hand-maintained subset - this set was missing
      // 'AeadAlgorithm' (among others), so e.g. `AeadAlgorithm ||
      // StreamCipherAlgorithm` snake_cased the former to a bare
      // `aead_algorithm` NameError while leaving the latter correctly
      // preserved, purely because one name happened to be listed here and
      // the other didn't.
      if (FRAMEWORK_ALGORITHM_BASES.includes(name) || FRAMEWORK_INSTANCE_BASES.includes(name)) {
        return new PythonIdentifier(escapePythonReserved(name));
      }

      // Preserve runtime globals that are referenced as bare values (not just
      // as the object of a MemberExpression call), e.g.:
      //   const OC = typeof OpCodes !== 'undefined' ? OpCodes : global.OpCodes;
      // Without this, the bare reference gets snake_cased to 'op_codes' /
      // 'js_object', which don't exist (only the PascalCase stub classes do).
      const RUNTIME_GLOBALS = new Set(['OpCodes', 'AlgorithmFramework', 'JSObject', 'JSArray']);
      if (RUNTIME_GLOBALS.has(name)) {
        return new PythonIdentifier(name);
      }

      // Bare `global` used as a plain VALUE (not `global.X`, which
      // transformMemberExpression already resolves to the real bound
      // `OpCodes`/`AlgorithmFramework`/`<X>` name - see there). This shows
      // up in root-object-picker idioms like
      // `typeof globalThis !== 'undefined' ? globalThis : ... : (typeof
      // global !== 'undefined' ? global : {})`, now reachable in this
      // branch since transformUnaryExpression folds `typeof global` to the
      // real ("object") answer. There is no single Python object standing
      // in for Node's `global` here (only its individual properties are
      // bound as module-level names), so emit an inert empty JSObject
      // rather than the reserved-word-escaped `global_` - a bare name
      // nothing ever defines (the IIFE parameter it used to be got dropped
      // by UMD/IIFE unwrapping) that NameErrors as soon as it's read.
      if (name === 'global') {
        return new PythonDict([]);
      }

      return new PythonIdentifier(toSnakeCase(name));
    }

    /**
     * If `n` is a `typeof x` expression (either the raw-ESTree
     * `UnaryExpression{operator:'typeof'}` shape or the IL AST's dedicated
     * `TypeOfExpression` node), return its argument (the `x`); otherwise null.
     * Shared by transformBinaryExpression's `typeof x === '...'` special-case
     * below.
     */
    _typeofArgument(n) {
      if (!n) return null;
      if (n.type === 'UnaryExpression' && n.operator === 'typeof') return n.argument;
      if (n.type === 'TypeOfExpression') return n.argument || n.value;
      return null;
    }

    /**
     * See the `&&`/`||` handling in transformBinaryExpression: rewrites a
     * bare (non-computed) member-access operand of a logical expression from
     * plain attribute access into `getattr(obj, 'name', None)`, so a
     * missing attribute reads as falsy (matching JS's `undefined`) instead
     * of raising AttributeError. Only fires when the ORIGINAL JS node was a
     * non-computed MemberExpression (i.e. `.foo`, not `[foo]` or a call) and
     * the already-transformed Python node is the plain PythonMemberAccess
     * that produces - anything else (self.* attribute reads, which are
     * already defaulted to None by _autoDeclareInstanceFields; method calls;
     * subscript/computed access; nested logical/binary sub-expressions,
     * which recurse through this same rewrite one level down) passes
     * through unchanged.
     */
    _safeLogicalMemberOperand(origNode, pyNode) {
      if (!origNode) return pyNode;
      // `!this.field.optionalProp` (or `!` over a computed subscript) as a
      // `&&`/`||` operand - e.g. asymmetric/ml-dsa.js's `messageLen === 0 ||
      // (bufLen === 32 && !this.privateKey.isSignatureMode)`, where the
      // generated `privateKey` object never actually defines
      // `isSignatureMode` at all (JS: reads `undefined`, `!undefined` is
      // `true`; a raw Python `not self.private_key.is_signature_mode`
      // attribute-reads a JSObject that has no such key, raising
      // AttributeError instead of tolerating the missing property the same
      // way a bare, un-negated `this.x.y || fallback` operand already does
      // below). Recurse on the negated argument first so the SAME
      // MemberExpression/computed-subscript leniency applies underneath the
      // `!`, then re-wrap with `not`.
      if (origNode.type === 'UnaryExpression' && origNode.operator === '!' &&
          pyNode instanceof PythonUnaryExpression && pyNode.operator === 'not') {
        const safeArgument = this._safeLogicalMemberOperand(origNode.argument, pyNode.operand);
        if (safeArgument !== pyNode.operand) return new PythonUnaryExpression('not', safeArgument);
        return pyNode;
      }

      // Accept both the raw-ESTree `MemberExpression` shape and the IL AST's
      // dedicated `ThisPropertyAccess` node (the normalized form of a bare
      // `this.foo` read - see transformThisPropertyAccess, which also
      // produces a plain PythonMemberAccess and needs the identical
      // leniency, e.g. siphash.js's CreateInstance-attached
      // `this._inputBuffer || []`).
      // A COMPUTED member access (`seq[idx]`) used as a `||`/`&&` operand -
      // e.g. kdf/bcrypt.js's `str[i++] || '.'` - is exactly as much a JS
      // "read or undefined, then fall back" truth test as the non-computed
      // `this._inputBuffer || []` case handled below, just spelled with
      // brackets instead of a dot. See the _js_idx stub's doc comment for
      // why a plain Python subscript can't tolerate the same out-of-range
      // read JS shrugs off as `undefined`. This must stay scoped to logical
      // operands (never a bare `seq[idx]` read elsewhere) - swallowing
      // IndexError/KeyError on every subscript read across the codebase
      // would mask genuine out-of-bounds bugs as silent Nones instead of
      // loud failures.
      if (origNode.type === 'MemberExpression' && origNode.computed && pyNode instanceof PythonSubscript) {
        return new PythonCall(new PythonIdentifier('_js_idx'), [pyNode.object, pyNode.index]);
      }

      const isEligible = (origNode.type === 'MemberExpression' || origNode.type === 'ThisPropertyAccess') && !origNode.computed;
      if (!isEligible) return pyNode;
      if (!(pyNode instanceof PythonMemberAccess)) return pyNode;
      // Only skip the getattr() safety net for a genuine class-instance
      // `self` (_objSelfNameStack empty) - a real class predeclares every
      // field it or its methods ever touch in __init__ (see e.g.
      // SaferInstance's constructor), so self.x is always present and the
      // wrapper would be pure overhead. An object-literal "this"
      // substitution (_objSelfNameStack non-empty, e.g. siphash.js's
      // CreateInstance dynamically attaching `instance.Feed = function(data)
      // { this._inputBuffer = (this._inputBuffer || []).concat(data); }`)
      // has no such guarantee: the module-level object literal never
      // declares `_inputBuffer` at all, it only ever comes into existence
      // the first time Feed() runs - so it needs the same getattr()-based
      // leniency as any other (non-self) object, or JSObject's now-strict
      // __getattr__ (see the JSObject helper stub) raises AttributeError
      // on the very first read instead of tolerating JS's `undefined`.
      if (this._objSelfNameStack.length === 0 &&
          pyNode.object instanceof PythonIdentifier && pyNode.object.name === this._currentSelfName()) return pyNode;
      return new PythonCall(new PythonIdentifier('getattr'), [
        pyNode.object,
        PythonLiteral.Str(pyNode.attribute),
        PythonLiteral.None()
      ]);
    }

    transformBinaryExpression(node) {
      // `(a / b) * 100` / `100 * (a / b)` - a percentage computation (e.g.
      // classical/al-kindi-frequency.js's `(frequencies[letter] /
      // totalLetters) * 100`). The default `/`-transform further below
      // (see its own doc comment) wraps a non-integer-literal-divisor
      // division in `int(...)` on the assumption that division in this
      // codebase is usually meant as integer (array-index/bit-width)
      // arithmetic - correct for the overwhelming majority of this
      // crypto-heavy codebase, but catastrophic here: `int(a / b) * 100`
      // truncates the (almost always < 1) fraction to 0 BEFORE scaling,
      // discarding the entire percentage instead of computing it (100
      // isn't a realistic array-index/bit-width scale factor, so this
      // signature is safe to special-case without touching the general
      // int-division default other code depends on).
      if (node.operator === '*') {
        const isHundredLiteral = (n) => n && n.type === 'Literal' && n.value === 100;
        const isDivision = (n) => n && n.type === 'BinaryExpression' && n.operator === '/';
        if ((isDivision(node.left) && isHundredLiteral(node.right)) ||
            (isDivision(node.right) && isHundredLiteral(node.left))) {
          const prevPreserveFloatDivision = this.preserveFloatDivision;
          this.preserveFloatDivision = true;
          try {
            const left = this.transformExpression(node.left);
            const right = this.transformExpression(node.right);
            return new PythonBinaryExpression(left, '*', right);
          } finally {
            this.preserveFloatDivision = prevPreserveFloatDivision;
          }
        }
      }

      // `typeof x === 'string'` (and !==/==/!=, either operand order) - a
      // *very* common JS idiom across this codebase's Feed()/setter methods
      // ("if given a string, convert to bytes; otherwise use as-is", 100+
      // occurrences). `typeof x` alone correctly becomes `type(x).__name__`
      // (see the 'TypeOfExpression'/'typeof' operator cases below), but the
      // JS-side comparison string ('string', 'number', 'boolean', ...) was
      // left untranslated - Python's actual `__name__` for a string is
      // "str", not "string", so `type(x).__name__ == "string"` is always
      // False and the conversion branch never runs (e.g. kmac.js's
      // encodeString() then unpacks the *raw* JS string character-by-character
      // instead of converting it to bytes first, corrupting every KMAC
      // vector). Recognize the whole comparison and emit the Python-native
      // equivalent directly instead of a string-vs-string comparison that
      // can never match.
      if (['===', '!==', '==', '!='].includes(node.operator)) {
        const leftArg = this._typeofArgument(node.left);
        const rightArg = leftArg ? null : this._typeofArgument(node.right);
        const typeofArg = leftArg || rightArg;
        const literalNode = leftArg ? node.right : node.left;
        if (typeofArg && literalNode && literalNode.type === 'Literal' && typeof literalNode.value === 'string') {
          const isNeg = node.operator === '!==' || node.operator === '!=';
          // `typeof crypto !== 'undefined'` etc. on a BARE identifier drawn
          // from a well-known JS host-environment global is a runtime
          // feature-detection probe (tolerating the JS ReferenceError a
          // plain read of an undeclared name would throw) - e.g.
          // sp800-108-*.js's `typeof crypto !== 'undefined' &&
          // crypto.subtle` Web-Crypto fallback. A plain
          // `this.transformExpression(typeofArg)` read of such a name
          // raises Python NameError the instant nothing defines it (nothing
          // ever does - these are Node/browser globals with no Python
          // equivalent), aborting the whole call instead of the probe
          // falsy-ing out the way it does in JS. Restrict this rewrite to a
          // curated allow-list (not any bare identifier) - typeof's other,
          // vastly more common use in this codebase is probing an actual
          // local/parameter's runtime type (`typeof data === 'string'`),
          // where the name IS a genuine Python local and a globals() lookup
          // would silently read the wrong (module-level, likely absent)
          // binding instead of raising - a correctness regression, not a fix.
          const ENV_PROBE_GLOBALS = new Set(['crypto', 'process', 'Buffer', 'performance', 'require', 'module', 'exports', 'define', 'window', 'globalThis', 'self', 'root', 'WebAssembly', 'BigInt', 'SharedArrayBuffer']);
          const argExpr = (typeofArg.type === 'Identifier' && ENV_PROBE_GLOBALS.has(typeofArg.name))
            ? new PythonCall(new PythonMemberAccess(new PythonCall(new PythonIdentifier('globals'), []), 'get'), [PythonLiteral.Str(toSnakeCase(typeofArg.name))])
            : this.transformExpression(typeofArg);
          const isType = (pyType) => new PythonCall(new PythonIdentifier('isinstance'), [argExpr, pyType]);
          let check = null;
          switch (literalNode.value) {
            case 'string': check = isType(new PythonIdentifier('str')); break;
            case 'boolean': check = isType(new PythonIdentifier('bool')); break;
            case 'number': check = isType(new PythonTuple([new PythonIdentifier('int'), new PythonIdentifier('float')])); break;
            case 'bigint': check = isType(new PythonIdentifier('int')); break;
            case 'function': check = new PythonCall(new PythonIdentifier('callable'), [argExpr]); break;
            case 'undefined':
              return new PythonBinaryExpression(argExpr, isNeg ? 'is not' : 'is', PythonLiteral.None());
          }
          if (check) return isNeg ? new PythonUnaryExpression('not', check) : check;
        }
      }

      // Handle AssignmentExpression and UpdateExpression in operands
      // Python doesn't support assignments or ++/-- as expressions
      // Extract them to pendingPreStatements/pendingPostStatements and use the appropriate value
      let left, right;

      // Helper to check for UpdateExpression
      const isUpdateExpr = (n) => n.type === 'UpdateExpression' ||
        (n.type === 'UnaryExpression' && (n.operator === '++' || n.operator === '--'));

      // Process left operand
      if (node.left.type === 'AssignmentExpression') {
        const assignment = this.transformAssignmentExpression(node.left);
        if (!this.pendingPreStatements) this.pendingPreStatements = [];
        this.pendingPreStatements.push(assignment);
        left = this.transformAssignmentExpressionForExpression(node.left, true);
      } else if (isUpdateExpr(node.left)) {
        // Handle ++x or x++ in left operand
        const target = this.transformExpression(node.left.argument);
        const one = PythonLiteral.Int(1);
        const op = node.left.operator === '++' ? '+=' : '-=';
        const updateStmt = new PythonAssignment(target, one);
        updateStmt.operator = op;
        updateStmt.isAugmented = true;

        if (node.left.prefix) {
          // Prefix ++x: increment first, then use new value
          if (!this.pendingPreStatements) this.pendingPreStatements = [];
          this.pendingPreStatements.push(updateStmt);
          left = this.transformExpression(node.left.argument);
        } else {
          // Postfix x++: use current value, then increment
          this.pendingPostStatements.push(updateStmt);
          left = this.transformExpression(node.left.argument);
        }
      } else {
        left = this.transformExpression(node.left);
      }

      // Process right operand
      if (node.right.type === 'AssignmentExpression') {
        const assignment = this.transformAssignmentExpression(node.right);
        if (!this.pendingPreStatements) this.pendingPreStatements = [];
        this.pendingPreStatements.push(assignment);
        right = this.transformAssignmentExpressionForExpression(node.right, true);
      } else if (isUpdateExpr(node.right)) {
        // Handle ++x or x++ in right operand
        const target = this.transformExpression(node.right.argument);
        const one = PythonLiteral.Int(1);
        const op = node.right.operator === '++' ? '+=' : '-=';
        const updateStmt = new PythonAssignment(target, one);
        updateStmt.operator = op;
        updateStmt.isAugmented = true;

        if (node.right.prefix) {
          // Prefix ++x: increment first, then use new value
          if (!this.pendingPreStatements) this.pendingPreStatements = [];
          this.pendingPreStatements.push(updateStmt);
          right = this.transformExpression(node.right.argument);
        } else {
          // Postfix x++: use current value, then increment
          this.pendingPostStatements.push(updateStmt);
          right = this.transformExpression(node.right.argument);
        }
      } else {
        right = this.transformExpression(node.right);
      }

      // `a && a.foo` / `a && a.foo && a.bar` (and the `||` equivalent) - a
      // very common JS defensive-check idiom (e.g. Dilithium/Falcon/Rainbow
      // KeySetup's `if (keyData && keyData.publicKey && keyData.privateKey)`
      // guarding which branch parses `keyData` as a real key object vs. a
      // raw byte array/string). JS property access never throws - reading
      // `.publicKey` off a plain array just yields `undefined`, so the whole
      // `&&` chain short-circuits to falsy and falls through to the
      // array/string branches below. Plain Python attribute access on
      // `keyData.public_key` raises AttributeError the instant `keyData` is
      // a list (no such attribute) instead of yielding a falsy value,
      // aborting the whole call - even though this operand only exists to be
      // truth-tested, never to assert the attribute exists. Any bare
      // (non-computed) member-access operand of `&&`/`||` is exactly such a
      // truth test; swap it for `getattr(obj, 'name', None)`, which mirrors
      // JS's read-or-undefined semantics for any object type while leaving
      // genuine attribute reads (constructor-assigned self.* fields, method
      // calls, computed/subscript access, everything outside a logical
      // operand) untouched.
      if (node.operator === '&&' || node.operator === '||') {
        left = this._safeLogicalMemberOperand(node.left, left);
        right = this._safeLogicalMemberOperand(node.right, right);
      }

      // `node.symbol === undefined` / `x.y !== undefined` (either operand
      // order) - a bare (non-computed) member-access side of a direct
      // undefined/null comparison is exactly as much a "does this property
      // even exist" truth test as the same expression used as a logical
      // `&&`/`||` operand (see the doc comment just above) - e.g.
      // compression/deflate.js's HuffmanTree.decode() walking its
      // node/one/zero/symbol tree, `while (node.symbol === undefined)`: an
      // internal tree node legitimately has no `symbol` field at all (only
      // leaf nodes do), which JS reads as `undefined` and this loop
      // condition is built to test for, but a plain Python
      // `node.symbol` attribute read raises AttributeError instead,
      // aborting Huffman decoding entirely instead of continuing to walk
      // deeper into the tree.
      // A literal `undefined` reaches here as a bare `Identifier` named
      // "undefined" in some shapes, but the shared IL parser normalizes it
      // to a `Literal` node with `resultType: 'void'` (and no `.value` at
      // all, since JSON/JS `undefined` isn't serializable) in others - see
      // the identical check in _collectUndefinedCheckedNames just above -
      // both must be recognized here or this fires for one code path but
      // not the other.
      const isUndefinedOrNullLiteral = (n) => n && ((n.type === 'Identifier' && (n.name === 'undefined' || n.name === 'null')) ||
        (n.type === 'Literal' && n.resultType === 'void'));
      if (['===', '!==', '==', '!='].includes(node.operator)) {
        if (isUndefinedOrNullLiteral(node.right)) left = this._safeLogicalMemberOperand(node.left, left);
        else if (isUndefinedOrNullLiteral(node.left)) right = this._safeLogicalMemberOperand(node.right, right);
      }

      let operator = node.operator;

      // Map JavaScript operators to Python
      if (operator === '===') operator = '==';
      if (operator === '!==') operator = '!=';
      if (operator === '&&') operator = 'and';
      if (operator === '||') operator = 'or';

      // Handle instanceof -> isinstance(left, right)
      if (operator === 'instanceof') {
        return new PythonCall(new PythonIdentifier('isinstance'), [left, right]);
      }

      // Handle division - use integer division when dividing by integer literals
      // This is safe for cryptographic code where most division is integer division
      if (operator === '/') {
        // Set by the MathCall handler for Math.ceil/floor/round/trunc's own
        // argument expression: that caller needs the true float quotient
        // (rounding IS the point), so neither the `//` nor the int()
        // fallback below - both of which truncate before rounding ever
        // runs - may fire here. See the MathCall 'ceil'/'floor'/etc. case
        // for the concrete bug this prevents.
        if (this.preserveFloatDivision) {
          return new PythonBinaryExpression(left, '/', right);
        }
        // If either operand is explicitly float-typed (a `1.0`-style decimal
        // literal, or a variable/expression the shared parser already knows
        // holds a float - see type-aware-transpiler.js's
        // _isExplicitFloatLiteralText), this is genuine floating-point math
        // (e.g. a PRNG's `1.0 / IM` scaling factor), not the usual
        // "int / int truncated toward an array index" idiom the fallbacks
        // below assume. Forcing that case through // or int() silently
        // truncates it to 0 whenever the exact quotient is < 1.
        const isFloatOperand = (n) => {
          const t = n && n.resultType;
          if (t !== 'float32' && t !== 'float64' && t !== 'float' && t !== 'double') return false;
          // The shared parser's resultType tag on `this.<name>` is only ever
          // set once, from how the name was FIRST assigned - it doesn't know
          // that (or any) assignment's own `/` got floor-divided by this
          // same codegen (see _knownIntThisProps's doc comment). Once we've
          // proven a given `this.<name>` is actually integer-valued, stop
          // trusting the stale tag for it.
          let rawPropName = null;
          if (n.type === 'ThisPropertyAccess' && !n.computed) {
            rawPropName = n.property;
          } else if (n.type === 'MemberExpression' && !n.computed && n.object && n.object.type === 'ThisExpression') {
            rawPropName = n.property && (n.property.name || n.property.value);
          }
          if (rawPropName && this._knownIntThisProps.has(rawPropName)) return false;
          return true;
        };
        if (isFloatOperand(node.left) || isFloatOperand(node.right)) {
          return new PythonBinaryExpression(left, '/', right);
        }
        // A BigInt literal divisor (`d = d / 2n`) is just as much an exact
        // integer division as a plain-number literal divisor - but
        // `Number.isInteger(node.right.value)` is FALSE for a JS BigInt
        // value (it's typeof 'bigint', not 'number'), so both integer-literal
        // checks below used to miss every BigInt divisor and fall through to
        // the float-division fallback further down. `int(a / b)` truncates
        // AFTER converting through a float, which silently loses precision
        // for any operand >= 2^53 - exactly the range BigInt division is
        // used for (512+ bit RSA/Rabin-style modular arithmetic). That
        // corrupted e.g. asymmetric/rabin.js's Miller-Rabin `n - 1 = 2^r * d`
        // decomposition (`d = d / 2n`) for any real-sized key, silently
        // returning a wrong `d` and making is_probably_prime reject every
        // actual prime - not a crash, just wrong crypto (surfaced here as
        // the prime search running seemingly forever).
        const isIntegerLiteral = (n) => n.type === 'Literal' &&
          (Number.isInteger(n.value) || typeof n.value === 'bigint');
        // A large (>= 1,000,000), non-power-of-two integer-literal divisor is
        // the signature of an LCG/PRNG modulus normalization
        // (`this.seed / 2147483647` -> a [0, 1) fraction), not the usual
        // small-literal array-index/bit-width divisor the // fallback below
        // assumes - repo-wide, every other >= 1e6 literal divisor found by
        // AST scan is a power of two (0x100000000-style 64->32-bit word
        // splits, already Math.floor()-wrapped by the source so exact
        // integer // division there is harmless/equivalent). Power-of-two
        // divisors are deliberately excluded from this branch and keep
        // falling into the // case below. Compare/mask via BigInt throughout
        // so a BigInt divisor never mixes types with a plain Number (JS
        // throws TypeError on `bigint & number`).
        if (isIntegerLiteral(node.right)) {
          const magnitude = BigInt(node.right.value);
          if (magnitude >= 1000000n && (magnitude & (magnitude - 1n)) !== 0n) {
            return new PythonBinaryExpression(left, '/', right);
          }
          return new PythonBinaryExpression(left, '//', right);
        }
        // For other cases, wrap the result in int() to ensure integer result
        // when used in integer contexts (array indices, range, etc.)
        return new PythonCall(new PythonIdentifier('int'), [
          new PythonBinaryExpression(left, '/', right)
        ]);
      }

      // JS shift operators (<<, >>, >>>) on plain Numbers always mask their
      // right-hand shift count to 5 bits (ToUint32(count) & 0x1F) per spec,
      // so a shift count that overflows 31 wraps around instead of erroring
      // - e.g. `x << 40` behaves exactly like `x << 8` in JS. Python's
      // `<<`/`>>` have no such masking: a computed shift count that (through
      // some upstream 32-bit wraparound in the algorithm) ends up outside
      // 0-31, or negative, either produces a wrong (unbounded-precision)
      // result or raises `ValueError: negative shift count`, aborting the
      // whole vector.
      // Skip the mask for small non-negative integer-literal counts (the
      // overwhelmingly common case, e.g. `x << 3`) to keep generated code
      // readable; apply it whenever the count is anything else - EXCEPT when
      // this is a BigInt shift (OpCodes.ShiftLn/ShiftRn, used for 64-bit
      // arithmetic - see type-aware-transpiler.js's INLINE_OPCODES
      // `bigint: true` entries). JS BigInt `<<`/`>>` are arbitrary-precision
      // and never mask/truncate the shift count (that's the entire reason
      // those ops use BigInt instead of Number), so masking here would
      // silently corrupt every 64-bit rotate/shift amount >= 32.
      const isBigIntShift = node.bigint === true ||
        (node.right && node.right.resultType === 'bigint') ||
        (node.right && node.right.type === 'Literal' && typeof node.right.value === 'bigint');
      const maskShiftAmount = (rightNode, rightPy) => {
        if (isBigIntShift) return rightPy;
        if (rightNode && rightNode.type === 'Literal' &&
            typeof rightNode.value === 'number' &&
            Number.isInteger(rightNode.value) &&
            rightNode.value >= 0 && rightNode.value < 32) {
          return rightPy;
        }
        return new PythonBinaryExpression(rightPy, '&', PythonLiteral.Int(31));
      };

      // Handle unsigned right shift (convert to mask)
      if (operator === '>>>') {
        // JS `>>>` always ToUint32-coerces its left operand FIRST, then does
        // a logical (zero-fill) shift. `left` here can be a negative Python
        // int (e.g. the result of a prior Math.imul/ToInt signed-32-bit
        // conversion) representing the same bit pattern as an unsigned
        // value - masking AFTER shifting (the previous approach) is wrong
        // for negative left, because Python's `>>` on a negative int is an
        // arithmetic (sign-extending) shift, not the logical shift `>>>`
        // requires: e.g. (-1) >> 16 stays -1 (then & mask wrongly yields
        // 0xFFFFFFFF), whereas masking first gives 0xFFFFFFFF >> 16 = 0xFFFF,
        // matching JS. Mask-then-shift is required for correctness.
        const maskedLeft = new PythonBinaryExpression(left, '&', PythonLiteral.Int(0xFFFFFFFF));
        // x >>> 0 is a common JavaScript idiom for converting to uint32
        if (node.right.type === 'Literal' && node.right.value === 0) {
          return maskedLeft;
        }
        // General case: x >>> n becomes (x & mask) >> n (already <= mask after masking, no re-mask needed)
        return new PythonBinaryExpression(maskedLeft, '>>', maskShiftAmount(node.right, right));
      }

      if (operator === '<<' || operator === '>>') {
        return new PythonBinaryExpression(left, operator, maskShiftAmount(node.right, right));
      }

      // Handle string concatenation with non-strings
      // In JavaScript, "foo" + 123 works automatically, but Python requires str(123)
      if (operator === '+') {
        const leftType = node.left.resultType;
        const rightType = node.right.resultType;
        const leftIsString = leftType === 'string' || (node.left.type === 'Literal' && typeof node.left.value === 'string');
        const rightIsString = rightType === 'string' || (node.right.type === 'Literal' && typeof node.right.value === 'string');

        if (leftIsString && !rightIsString) {
          // "string" + number -> "string" + str(number)
          const wrappedRight = new PythonCall(new PythonIdentifier('str'), [right]);
          return new PythonBinaryExpression(left, operator, wrappedRight);
        }
        if (!leftIsString && rightIsString) {
          // number + "string" -> str(number) + "string"
          const wrappedLeft = new PythonCall(new PythonIdentifier('str'), [left]);
          return new PythonBinaryExpression(wrappedLeft, operator, right);
        }
      }

      // NOTE: a targeted attempt to also apply _lowerAsFloat64Chain's
      // IEEE-754 rounding replica (see its doc comment) to raw `&`/`|`/`^`
      // operators - not just the explicit `OpCodes.ToUint32/ToInt32(...)`
      // call site that already triggers it via transformCast() - was tried
      // here (fixing ecc/repeat-accumulate-code.js's seeded-LCG shuffle)
      // and reverted: it repeatedly misfired on unrelated exact-integer
      // code (inlined `OpCodes.AndN/OrN/XorN(...)` calls already correct
      // for BigInt, and several PRNGs whose raw `*` operand turned out to
      // be some other already-exact case not distinguishable from the
      // genuinely-lossy-Number-multiply case without much deeper
      // per-operand type analysis than is safely available here) - each
      // narrowing attempt fixed one regression only to surface another.
      // Given the risk of silently corrupting already-correct output
      // elsewhere, this is intentionally left as the narrower, already-
      // vetted ToUint32/ToInt32-only trigger.

      return new PythonBinaryExpression(left, operator, right);
    }

    // Does `node` (an untransformed IL/JS AST node) contain a raw `*`
    // reachable through a chain of +/- operators, that ISN'T already an
    // inlined, Math.imul-based OpCodes.Mul32 (flagged `ilNodeType:
    // 'InlinedOpCode'`, already exact)? Used by transformCast() to decide
    // whether an OpCodes.ToUint32/ToInt32 argument needs the double-
    // rounding-replica lowering below instead of ordinary exact-integer
    // transformation - see _lowerAsFloat64Chain's doc comment for why.
    static _treeHasFloat64Mul(node) {
      if (!node || typeof node !== 'object') return false;
      if (node.type === 'BinaryExpression' && (node.operator === '+' || node.operator === '-')) {
        return PythonTransformer._treeHasFloat64Mul(node.left) || PythonTransformer._treeHasFloat64Mul(node.right);
      }
      return node.type === 'BinaryExpression' && node.operator === '*' && node.ilNodeType !== 'InlinedOpCode';
    }

    // Lowers `node` - the untransformed argument of an OpCodes.ToUint32/
    // ToInt32 call already known (via _treeHasFloat64Mul) to contain a raw
    // `*` - into Python code that replicates JS's actual IEEE-754 double
    // arithmetic through the *entire* +/-/* chain, not just the individual
    // multiply.
    //
    // JS `*`/`+`/`-` on plain Numbers are ALWAYS computed in double
    // precision, silently losing low-order bits once a partial result
    // exceeds 2^53 - routine for crypto code that multiplies two ~32-bit
    // words (product up to just under 2^64), e.g. khufu's LCG
    // `OpCodes.ToUint32(1103515245 * state + 12345)`. Python's `*`/`+` on
    // ints are always exact, so naively transforming each operator and
    // wrapping only the innermost `*` in `int(float(a)*float(b))` is NOT
    // equivalent: JS never rounds the multiply back down to an integer
    // before adding - it keeps accumulating in the SAME double all the way
    // to the final ToUint32, so a later `+ 12345` can itself be swallowed
    // by the multiply's rounding error (adding a small constant to an
    // already-huge, coarsely-quantized double often doesn't change the
    // double's bit pattern at all) in a way that re-exactifying via `int()`
    // after the multiply alone would miss entirely. Emitting the whole
    // chain with plain Python `float` operands and Python `+`/`-`/`*`
    // (themselves IEEE-754 binary64, identical to JS Numbers) reproduces
    // JS's rounding bit-for-bit through every intermediate step; the caller
    // converts back to int only once, at the final ToUint32/ToInt32 mask -
    // exactly mirroring where JS's own truncation happens.
    //
    // A leaf reached this way that is itself a raw `^`/`&`/`|` result needs
    // one more correction: those IL ops are JS-spec ToInt32'd (stored as a
    // SIGNED value in [-2^31, 2^31-1]), but this transformer's unmasked
    // translation of them (see XorN/AndN/OrN in INLINE_OPCODES) computes
    // Python's `^`/`&`/`|` on non-negative ints, always yielding the
    // non-negative bit-pattern value instead. That representation choice is
    // invisible through further pure bitwise ops (representation-
    // independent), but changes the IEEE-754 rounding of this float chain:
    // multiplying by the small-magnitude negative interpretation (what JS
    // really does) can land on a completely different, exactly-
    // representable double than multiplying by the large-magnitude non-
    // negative one. Reinterpret such a leaf as JS would see it before
    // entering the float chain.
    //
    // An inlined OpCodes.Mul32 sub-multiply (Math.imul-based, already exact
    // and pre-masked to uint32) is left as ordinary exact-integer
    // transformation and just cast to `float` at the leaf boundary - its
    // result is already a definite, exactly-representable integer, so
    // re-entering the float domain there is lossless and correctly models
    // JS treating that sub-result as a fresh, already-computed Number.
    _lowerAsFloat64Chain(node) {
      if (node.type === 'BinaryExpression' && (node.operator === '+' || node.operator === '-') &&
          node.ilNodeType !== 'InlinedOpCode') {
        return new PythonBinaryExpression(
          this._lowerAsFloat64Chain(node.left),
          node.operator,
          this._lowerAsFloat64Chain(node.right)
        );
      }
      if (node.type === 'BinaryExpression' && node.operator === '*' && node.ilNodeType !== 'InlinedOpCode') {
        return new PythonBinaryExpression(
          this._lowerAsFloat64Chain(node.left),
          '*',
          this._lowerAsFloat64Chain(node.right)
        );
      }
      // Leaf (or an inlined/masked sub-op, e.g. Mul32/Add32/Xor32): transform
      // normally, reinterpret as JS-signed if it's a raw ^/&/| result, then
      // enter the float domain.
      const transformed = this.transformExpression(node);
      // Also treat a plain variable reference as a raw bitwise result when
      // it was declared as one (see _rawBitwiseVarNames' doc comment) -
      // the raw ^/&/| op may have been factored into its own statement
      // rather than inlined directly here.
      const isRawBitwiseResult = (node.type === 'BinaryExpression' && ['^', '&', '|'].includes(node.operator) &&
        node.ilNodeType !== 'InlinedOpCode') ||
        (node.type === 'Identifier' && this._rawBitwiseVarNames && this._rawBitwiseVarNames.has(node.name));
      const asJsInt32 = isRawBitwiseResult
        ? new PythonConditional(
            new PythonBinaryExpression(transformed, '-', PythonLiteral.Int(0x100000000)),
            new PythonBinaryExpression(transformed, '>=', PythonLiteral.Int(0x80000000)),
            transformed
          )
        : transformed;
      return new PythonCall(new PythonIdentifier('float'), [asJsInt32]);
    }

    // Browser/Node-only pseudo-globals that a `typeof X !== 'undefined'`
    // feature-detection guard checks for but that never exist as a
    // declared Python name. JS's `typeof` is safe on an undeclared
    // identifier (evaluates to 'undefined' rather than throwing); Python
    // has no equivalent - `type(x)` still has to evaluate `x` first, so a
    // literal `type(global_this).__name__` blows up with NameError before
    // the comparison even runs. Used by transformUnaryExpression() below to
    // fold `typeof <pseudo-global>` straight to the literal "undefined"
    // instead, matching JS's actual runtime answer for an environment that
    // (correctly) never defines these.
    // 'global' is deliberately excluded: unlike the others, JS code in this
    // codebase routinely declares a *local* variable literally named
    // `global` (`const global = typeof globalThis !== 'undefined' ? ... `)
    // and keeps using it afterwards, so blindly folding `typeof global` to
    // "undefined" would break that declared variable's own later checks;
    // `global.X` member access already has separate handling (see the
    // `global`/`globalThis` prefix-stripping branch in
    // transformMemberExpression above).
    static UNDECLARABLE_JS_GLOBALS = new Set(['globalThis', 'window', 'document', 'self']);

    // resultType names the shared type-aware parser uses for values that are
    // actually BigInt at runtime (64-bit PRNG/hash state, explicit qword/long
    // casts, BigInt literals) rather than a plain 32-bit-truncated JS Number.
    static WIDE_INT_RESULT_TYPES = new Set(['bigint', 'uint64', 'int64', 'qword']);
    static isWideIntResultType(resultType) {
      return PythonTransformer.WIDE_INT_RESULT_TYPES.has(resultType);
    }

    transformUnaryExpression(node) {
      let operator = node.operator;

      if (operator === 'typeof' && node.argument.type === 'Identifier' &&
          PythonTransformer.UNDECLARABLE_JS_GLOBALS.has(node.argument.name)) {
        return PythonLiteral.Str('undefined');
      }

      // `typeof global` (bare Identifier, not `global.X`) - unlike
      // globalThis/window/document/self, Node.js's `global` genuinely IS
      // defined (`typeof global === 'object'`) - and `global.X` member
      // access already resolves through transformMemberExpression's
      // `global.OpCodes` / `global.AlgorithmFramework` / `global.<X>`
      // fallback rules, so guards like
      // `typeof global !== 'undefined' && global.AlgorithmFramework` are
      // meant to gate real, reachable code (see ed25519.js's
      // AlgorithmFramework.Find('SHA-512') lookup) - folding this to
      // "undefined" like the browser-only pseudo-globals would skip that
      // reachable branch for no reason. Fold to the real runtime answer
      // instead so `!== 'undefined'` comparisons come out true.
      if (operator === 'typeof' && node.argument.type === 'Identifier' &&
          node.argument.name === 'global') {
        return PythonLiteral.Str('object');
      }

      // `!this.field` where this class's constructor initializes `field` to
      // `null` (see the `_nullDefaultFields` doc comment in
      // transformClassDeclaration) - a required-field-missing guard like
      // kdf/bcrypt.js's `if (!this.password) throw ...`. Emit `field is
      // None` instead of the generic Python-falsy `not field` below: an
      // empty-but-actually-provided array/string (e.g. the empty-password
      // KAT vector) is falsy in Python but truthy in JS, so the generic
      // path would incorrectly trip this guard for a legitimately empty
      // value JS itself never rejects.
      if (operator === '!' && this._nullDefaultFields && this._nullDefaultFields.size > 0) {
        const arg = node.argument;
        const isThisField = (arg?.type === 'ThisPropertyAccess' && !arg.computed) ||
          (arg?.type === 'MemberExpression' && !arg.computed && arg.object?.type === 'ThisExpression');
        if (isThisField) {
          const rawField = typeof arg.property === 'string' ? arg.property : (arg.property?.name || arg.property?.value);
          const foldedField = rawField ? toSnakeCaseProperty(rawField) : null;
          if (foldedField && this._nullDefaultFields.has(foldedField)) {
            const fieldOperand = this.transformExpression(arg);
            return new PythonBinaryExpression(fieldOperand, 'is', PythonLiteral.None());
          }
        }
      }

      const operand = this.transformExpression(node.argument);

      // Map operators
      if (operator === '!') operator = 'not';
      if (operator === 'typeof') {
        // typeof x -> type(x).__name__
        return new PythonMemberAccess(
          new PythonCall(new PythonIdentifier('type'), [operand]),
          '__name__'
        );
      }

      const result = new PythonUnaryExpression(operator, operand);
      // `~` on a 64-bit/BigInt-typed operand (e.g. `~seed64` in the
      // MSWS/xoshiro/splitmix64-family PRNGs) must NOT be truncated to
      // 32 bits the way a plain JS Number `~` is - JS BigInt `~x` is
      // arbitrary-precision two's complement (`-x-1`), exactly like
      // Python's `~x`. The emitter defaults to masking `~` results to
      // 0xFFFFFFFF (correct for the far more common 32-bit case); flag
      // wide operands here so it can skip that mask instead of silently
      // truncating 64-bit state to 32 bits.
      if (operator === '~') {
        const argResultType = node.argument && node.argument.resultType;
        // Confidently-wide type, OR an untyped/ambiguous fallback (no
        // resultType at all - e.g. a computed array-element read like
        // mac/blake2bmac.js's `v[14] = ~v[14]` on its 64-bit BLAKE2b working
        // vector, which the shared parser never tracks per-element - or the
        // 'uint8' fallback default) inside a file that uses BigInt anywhere
        // else - see _scanForBigIntLiterals()'s doc comment for why treating
        // either ambiguous case as wide is safe there.
        if (PythonTransformer.isWideIntResultType(argResultType) ||
            (this._fileHasBigIntLiterals && (argResultType === 'uint8' || !argResultType))) {
          result.isBigInt = true;
        }
      }
      return result;
    }

    transformUpdateExpression(node) {
      // Convert i++ to i += 1
      const target = this.transformExpression(node.argument);
      const one = PythonLiteral.Int(1);
      const operator = node.operator === '++' ? '+=' : '-=';

      const assignment = new PythonAssignment(target, one);
      assignment.operator = operator;
      assignment.isAugmented = true;

      // Store info about prefix/postfix for expression context handling
      assignment._isPrefix = node.prefix;
      assignment._originalTarget = target;

      return assignment;
    }

    /**
     * Transform an expression that is used in a position that must be a plain
     * value in Python (e.g. a subscript index, function argument slot handled
     * elsewhere without side-effect support). If the node is an UpdateExpression
     * (i++/++i) or AssignmentExpression, hoist the side effect into
     * pendingPreStatements/pendingPostStatements (matching the established pattern
     * used by transformBinaryExpression etc.) and return the plain value expression.
     * Python has no equivalent of `x[i++]` - the increment must become a separate statement.
     */
    transformSideEffectFreeValue(node) {
      if (!node) return this.transformExpression(node);

      const isUpdateExpr = (n) => n.type === 'UpdateExpression' ||
        (n.type === 'UnaryExpression' && (n.operator === '++' || n.operator === '--'));

      if (node.type === 'AssignmentExpression') {
        const assignment = this.transformAssignmentExpression(node);
        if (!this.pendingPreStatements) this.pendingPreStatements = [];
        this.pendingPreStatements.push(assignment);
        return this.transformAssignmentExpressionForExpression(node, true);
      }

      if (isUpdateExpr(node)) {
        const target = this.transformExpression(node.argument);
        const one = PythonLiteral.Int(1);
        const op = node.operator === '++' ? '+=' : '-=';
        const updateStmt = new PythonAssignment(target, one);
        updateStmt.operator = op;
        updateStmt.isAugmented = true;

        if (node.prefix) {
          // Prefix ++x: increment first, then use new value
          if (!this.pendingPreStatements) this.pendingPreStatements = [];
          this.pendingPreStatements.push(updateStmt);
        } else {
          // Postfix x++: use current value, then increment
          if (!this.pendingPostStatements) this.pendingPostStatements = [];
          this.pendingPostStatements.push(updateStmt);
        }
        return this.transformExpression(node.argument);
      }

      return this.transformExpression(node);
    }

    /**
     * Transform UpdateExpression for expression context (e.g., inside subscript)
     * Python doesn't support i++ or ++i as expressions, so we handle specially:
     * - Postfix i++: returns i (the old value before increment)
     * - Prefix ++i: returns i + 1 (the new value after increment)
     * Note: This loses the side-effect of the increment. Callers should handle
     * incrementing separately if needed.
     */
    transformUpdateExpressionForExpression(node) {
      const target = this.transformExpression(node.argument);

      if (node.prefix) {
        // ++i: return i + 1 (or i - 1 for --)
        const one = PythonLiteral.Int(1);
        const op = node.operator === '++' ? '+' : '-';
        return new PythonBinaryExpression(target, op, one);
      } else {
        // i++: return just i (the old value)
        return target;
      }
    }

    /**
     * Transform AssignmentExpression for expression context (e.g., inside subscript, function args)
     * Python doesn't support compound assignments (i += 1) as expressions in these contexts.
     * For -= compound assignments in array indexing like key[p -= 1], we need to return
     * the NEW value (p - 1) since Python evaluates the index after decrement.
     * For simple assignments (a = b), we return b (the assigned value).
     * Note: This loses the side-effect. Callers should handle the actual assignment separately.
     */
    /**
     * True if re-transforming `node` a second time (after it has already been
     * transformed once as an assignment target) is guaranteed side-effect-free -
     * i.e. it contains no post/pre-increment or nested assignment inside a
     * computed subscript (like `key[keyIndex++]` or `arr[x = y]`). Plain
     * identifiers, dotted member access, and subscripts with a plain-value
     * index are always safe to re-transform.
     */
    isSideEffectFreeTarget(node) {
      if (!node) return true;
      if (node.type === 'MemberExpression') {
        if (node.computed) {
          const prop = node.property;
          const isUpdate = prop.type === 'UpdateExpression' ||
            (prop.type === 'UnaryExpression' && (prop.operator === '++' || prop.operator === '--'));
          if (isUpdate || prop.type === 'AssignmentExpression') return false;
        }
        return this.isSideEffectFreeTarget(node.object);
      }
      return true;
    }

    /**
     * @param {boolean} alreadyMutated - true when the caller already hoisted
     *   this assignment's real mutation as its OWN statement, executed
     *   before this expression is evaluated (every call-argument/subscript-
     *   index/object-literal-property-value caller: they each push the full
     *   `transformAssignmentExpression(node)` STATEMENT onto
     *   pendingPreStatements first, then call this function purely to get
     *   the substitute VALUE for the original expression position - see e.g.
     *   the CallExpression argument handling around
     *   `pendingPreStatements.push(assignment)`). In that case `node.left`
     *   has ALREADY been updated to its final value by the time this runs,
     *   so a compound op (`+=`/`-=`/...) must just re-read the target, NOT
     *   recompute `target OP value` from scratch - recomputing double-
     *   applies the operation (e.g. hash/skein.js's `rotlXor64(b1, ROT, b0
     *   += b1)`: the hoisted `b0 += b1` statement already sets b0 to
     *   b0_old+b1, so the call argument must reuse that same new b0 -
     *   re-deriving `b0 + b1` here adds b1 to it a SECOND time,
     *   corrupting every round of the Threefish permutation from the very
     *   first mix). False (the default) is for the one caller where no such
     *   statement is ever emitted - transformLambdaBody, building a Python
     *   lambda body, which cannot contain a hoisted statement at all and
     *   must instead simulate the value by recomputing it inline (a
     *   pre-existing, accepted limitation: the actual mutation is lost, only
     *   the computed value survives) - and the recursive chained-assignment
     *   fallback (`a = b += c`), which mirrors whatever mode its own caller
     *   is already in.
     */
    transformAssignmentExpressionForExpression(node, alreadyMutated = false) {
      const op = node.operator;

      if (op === '=') {
        // Simple assignment: return the value now held by the target.
        // Prefer re-reading the (already-assigned) target itself rather than
        // re-transforming node.right's expression tree: node.right may
        // reference variables that the just-hoisted assignment statement(s)
        // already mutated (e.g. safer+'s PHT `b[0] = (b[0] + (b[1] = (b[0] +
        // b[1]) & 255)) & 255` - recomputing `(b[0]+b[1])&255` here would read
        // the NEW b[1] instead of reusing the value it was just set to).
        // This is only safe when node.left has no side effects of its own to
        // re-trigger (a plain identifier or a subscript with a constant/plain
        // index) - if it's something like `key[keyIndex++] = x`, the
        // increment was already hoisted once via transformAssignmentExpression()
        // as a pre-statement, and re-transforming node.left here would push a
        // second, duplicate increment (safer.js's
        // `kb[j] = key[keyIndex++] = userkey2_j` chain). In that case fall
        // back to resolving the final chained value instead (which for these
        // side-effecting-subscript chains is always a plain, unmutated value).
        if (this.isSideEffectFreeTarget(node.left)) {
          return this.transformExpression(node.left);
        }
        return node.right.type === 'AssignmentExpression'
          ? this.transformAssignmentExpressionForExpression(node.right, alreadyMutated)
          : this.transformExpression(node.right);
      }

      const target = this.transformExpression(node.left);

      // The hoisted statement (see this function's own `alreadyMutated` doc
      // comment above) already applied this compound op to node.left - just
      // re-read it. Skip transforming node.right entirely: it was already
      // consumed by that same hoisted statement, and re-transforming it here
      // would be redundant at best (a plain value) or wrongly re-trigger a
      // nested assignment's own side effect at worst.
      if (alreadyMutated) {
        return target;
      }

      const value = node.right.type === 'AssignmentExpression'
        ? this.transformAssignmentExpressionForExpression(node.right)
        : this.transformExpression(node.right);

      if (op === '+=') {
        // x += n: return x + n (the new value)
        return new PythonBinaryExpression(target, '+', value);
      } else if (op === '-=') {
        // x -= n: return x - n (the new value)
        return new PythonBinaryExpression(target, '-', value);
      } else if (op === '*=') {
        // x *= n: return x * n
        return new PythonBinaryExpression(target, '*', value);
      } else if (op === '/=') {
        // x /= n: return x / n
        return new PythonBinaryExpression(target, '/', value);
      } else if (op === '%=') {
        // x %= n: return x % n
        return new PythonBinaryExpression(target, '%', value);
      } else if (op === '&=') {
        // x &= n: return x & n
        return new PythonBinaryExpression(target, '&', value);
      } else if (op === '|=') {
        // x |= n: return x | n
        return new PythonBinaryExpression(target, '|', value);
      } else if (op === '^=') {
        // x ^= n: return x ^ n
        return new PythonBinaryExpression(target, '^', value);
      } else if (op === '<<=') {
        // x <<= n: return x << n
        return new PythonBinaryExpression(target, '<<', value);
      } else if (op === '>>=') {
        // x >>= n: return x >> n
        return new PythonBinaryExpression(target, '>>', value);
      } else if (op === '>>>=') {
        // x >>>= n: return (x >> n) & 0xFFFFFFFF
        const shift = new PythonBinaryExpression(target, '>>', value);
        return new PythonBinaryExpression(shift, '&', PythonLiteral.Int(0xFFFFFFFF));
      }

      // Fallback: just return the target (shouldn't happen with known operators)
      return target;
    }

    transformAssignmentExpression(node) {
      // Handle object destructuring: ({a: target1, b: target2} = source)
      // Python doesn't support this syntax, so we expand to sequential assignments
      // Note: Parser may produce ObjectExpression, ObjectPattern, or ObjectLiteral (from IL AST) for this pattern
      if (node.left && (node.left.type === 'ObjectPattern' || node.left.type === 'ObjectExpression' ||
          node.left.type === 'ObjectLiteral' || node.left.ilNodeType === 'ObjectLiteral')) {
        return this.transformObjectDestructuringAssignment(node);
      }

      // Clear pending pre/post-statements before transforming (to collect any increments/assignments in the right side)
      this.pendingPostStatements = [];
      this.pendingPreStatements = [];

      // Check for nested AssignmentExpression or UpdateExpression in the left side (subscripts)
      // e.g., key[p -= 1] = t4 needs to be transformed to:
      //   p -= 1
      //   key[p] = t4
      const preStatements = [];
      const cleanedLeft = this.extractNestedAssignmentsFromLeft(node.left, preStatements);

      // If we extracted pre-statements, we need to return a block
      if (preStatements.length > 0) {
        // Transform with the cleaned left side
        const cleanedNode = { ...node, left: cleanedLeft };
        const mainAssignment = this.transformAssignmentExpressionCore(cleanedNode);

        // Collect any pending pre/post-statements (e.g., assignments and postfix increments from call arguments on the right side)
        const additionalPreStatements = [...(this.pendingPreStatements || [])];
        const postStatements = [...this.pendingPostStatements];
        this.pendingPreStatements = [];
        this.pendingPostStatements = [];

        // Return a block containing pre-statements, the main assignment, and post-statements
        const block = new PythonBlock();
        block.statements = [...preStatements, ...additionalPreStatements, mainAssignment, ...postStatements];
        return block;
      }

      const mainAssignment = this.transformAssignmentExpressionCore(node);

      // Collect any pending pre/post-statements (e.g., assignments in function args and postfix increments)
      // This handles patterns like:
      //   temp = this._FO(temp, n++) -> temp = self._fo(temp, n); n += 1
      //   x = foo(y = 5) -> y = 5; x = foo(y)
      const additionalPreStatements = [...(this.pendingPreStatements || [])];
      const postStatements = [...this.pendingPostStatements];
      this.pendingPreStatements = [];
      this.pendingPostStatements = [];

      if (additionalPreStatements.length > 0 || postStatements.length > 0) {
        // Return a block containing pre-statements, the main assignment, and post-statements
        const block = new PythonBlock();
        block.statements = [...additionalPreStatements, mainAssignment, ...postStatements];
        return block;
      }

      return mainAssignment;
    }

    /**
     * Extract nested AssignmentExpressions and UpdateExpressions from the left side of an assignment.
     * Returns a cleaned node with the expressions replaced by their result identifiers.
     */
    extractNestedAssignmentsFromLeft(node, preStatements) {
      if (!node) return node;

      // Handle MemberExpression with computed property containing AssignmentExpression
      if (node.type === 'MemberExpression' && node.computed) {
        const prop = node.property;

        // Check for AssignmentExpression in subscript (e.g., key[p -= 1])
        if (prop.type === 'AssignmentExpression') {
          // Add the assignment as a pre-statement
          const assignStmt = this.transformAssignmentExpression(prop);
          preStatements.push(assignStmt);

          // Replace the property with just the left side (the variable after assignment)
          return {
            ...node,
            property: prop.left
          };
        }

        // Check for UpdateExpression in subscript (e.g., key[++p] or key[p++])
        // Note: Parser may produce UpdateExpression OR UnaryExpression with ++/-- operator
        const isUpdate = prop.type === 'UpdateExpression' ||
                        (prop.type === 'UnaryExpression' && (prop.operator === '++' || prop.operator === '--'));

        if (isUpdate) {
          const target = this.transformExpression(prop.argument);
          const one = PythonLiteral.Int(1);
          const op = prop.operator === '++' ? '+=' : '-=';

          if (prop.prefix) {
            // ++p: increment first, then use p
            const assignStmt = new PythonAssignment(target, one);
            assignStmt.operator = op;
            assignStmt.isAugmented = true;
            preStatements.push(assignStmt);

            return {
              ...node,
              property: prop.argument
            };
          } else {
            // p++: use p first, then increment
            // Need to use current value, so we use p in the subscript
            // and add increment as a POST-statement (not supported here, so we adjust)
            // For now, we'll add the increment before but use p (which has the post-increment value)
            // This is semantically different but matches common patterns like key[p++] where
            // you want to increment after accessing.
            // Actually for postfix, we need to be careful. key[p++] means key[p], then p++
            // So we should NOT add pre-statement, just use p in subscript
            // But we DO need to track that p needs incrementing after
            // For simplicity, we'll just use p directly (losing the side effect)
            // This is safe for array access patterns where the side effect is just iteration
            return {
              ...node,
              property: prop.argument
            };
          }
        }
      }

      return node;
    }

    /**
     * Core transformation logic for AssignmentExpression (called after pre-processing)
     */
    /**
     * Transform an assignment target expression. Identical to transformExpression
     * except array-literal targets ([a, b] = ...) become a PythonTuple instead of
     * a PythonList, since list literals are emitted as JSArray(...) calls (see
     * emitList) which are not valid Python assignment targets.
     */
    /**
     * Transform `node` as an unambiguous VALUE READ (a variable initializer
     * or plain-assignment RHS - never an assignment target or ++/-- operand),
     * enabling transformMemberExpression's `getattr(obj, 'prop', None)`
     * rewrite for the duration of this one transform (see
     * `_memberReadWrapEnabled`'s doc comment there). Scoped to these call
     * sites specifically, rather than every `transformExpression()` call
     * generally, because plenty of other call sites reuse the very same
     * function for assignment TARGETS (transformAssignmentTargetExpression's
     * fallback) or ++/-- operands, where the rewritten getattr(...) call
     * can't be assigned to.
     */
    _transformExpressionAsRead(node) {
      this._memberReadWrapEnabled = (this._memberReadWrapEnabled || 0) + 1;
      try {
        return this.transformExpression(node);
      } finally {
        this._memberReadWrapEnabled--;
      }
    }

    transformAssignmentTargetExpression(node) {
      if (node && (node.type === 'ArrayExpression' || node.type === 'ArrayLiteral' || node.type === 'ArrayPattern')) {
        const elements = (node.elements || []).map(el => el ? this.transformExpression(el) : PythonLiteral.None());
        return new PythonTuple(elements);
      }
      // `global.Foo = value` / `globalThis.Foo = value` (module-export
      // idiom, e.g. `global.DEAL = DEAL;`) as an assignment TARGET must stay
      // the plain snake_case identifier `transformMemberExpression()`
      // already produces for `global.<X>` (a fresh module-level name is a
      // valid assignment target) - not the `globals().get('foo')` *read*
      // expression it now falls back to for every other `global.<X>` use
      // (see the fallback's comment) so unresolved reads degrade to None
      // instead of NameError-ing. `globals().get('foo') = value` would be a
      // SyntaxError (can't assign to a call). transformMemberExpression()
      // doesn't know which context it's being called from, so intercept the
      // target case here, one level up, before the generic transform.
      if (node && node.type === 'MemberExpression' && !node.computed &&
          node.object && node.object.type === 'Identifier' &&
          (node.object.name === 'global' || node.object.name === 'globalThis')) {
        const propName = node.property.name || node.property.value;
        return new PythonIdentifier(toSnakeCase(propName));
      }
      return this.transformExpression(node);
    }

    transformAssignmentExpressionCore(node) {
      // `X.method = function(...) { ...this.foo...; return bar; }` -
      // dynamically attaching a method after construction (e.g. siphash.js's
      // `instance.Feed = function(data) { this._inputBuffer = ...; }` /
      // `.Result = function() {...}`, following `const instance =
      // Object.create(this); instance.Init();` instead of declaring Feed/
      // Result as object-literal properties). Routing this through the
      // generic RHS transform hits transformLambdaExpression -
      // Python lambdas are single-expression only, so a multi-statement
      // body silently collapses to `lambda *a: None` (every call then
      // returns None) - and even a trivial one-statement body would leave
      // bare `this` resolving to whatever _objSelfNameStack's *enclosing*
      // hoisted function happened to leave on top (or plain 'self' with
      // nothing sensible behind it), not `instance`. Hoist a real named
      // function exactly like transformObjectExpression does for the
      // equivalent object-literal-property spelling, using the assignment
      // target's own object as the `this` substitution.
      if (node.operator === '=' && node.left && node.left.type === 'MemberExpression' && !node.left.computed &&
          (node.right?.type === 'FunctionExpression' || node.right?.type === 'ArrowFunctionExpression') &&
          node.right.body && node.right.body.type === 'BlockStatement') {
        const propName = node.left.property?.name || node.left.property?.value || 'fn';
        const objSelfName = node.left.object?.type === 'Identifier' ? toSnakeCase(node.left.object.name) : null;
        this._objFnCounter = (this._objFnCounter || 0) + 1;
        const helperName = '_objfn_' + toSnakeCase(propName) + '_' + this._objFnCounter;
        if (objSelfName) this._objSelfNameStack.push(objSelfName);
        let funcDef;
        try {
          funcDef = this.transformArrowToFunction(helperName, node.right);
        } finally {
          if (objSelfName) this._objSelfNameStack.pop();
        }
        if (!this.pendingPreStatements) this.pendingPreStatements = [];
        this.pendingPreStatements.push(funcDef);
        const target = this.transformExpression(node.left);
        return new PythonAssignment(target, new PythonIdentifier(helperName));
      }

      // Handle ClassExpression assignment: varName = class extends Base { ... }
      // In Python, we can't assign class definitions directly; we need to emit the class with a proper name
      // Transform to: class ClassName(Base): ...  (and use ClassName as the variable name)
      if (node.right && node.right.type === 'ClassExpression' && node.operator === '=') {
        // Get the variable name being assigned to
        let className = 'AnonymousClass';
        if (node.left.type === 'Identifier') {
          className = toPascalCase(node.left.name);
        } else if (node.left.type === 'MemberExpression' && node.left.property) {
          className = toPascalCase(node.left.property.name || node.left.property.value || 'AnonymousClass');
        }

        // Create a modified ClassExpression node with the proper name
        const namedClassNode = {
          ...node.right,
          id: { type: 'Identifier', name: className }
        };

        // Transform the class expression to a class definition
        const classDef = this.transformClassExpression(namedClassNode);

        // Return the class definition directly (no assignment needed)
        return classDef;
      }

      // Handle array length assignment: arr.length = 0 -> arr.clear()
      // In JavaScript, setting length to 0 clears the array
      if (node.left && node.left.type === 'ArrayLength' && node.operator === '=') {
        const rightVal = node.right;
        const isZero = (rightVal.type === 'Literal' && rightVal.value === 0) ||
                       (rightVal.type === 'NumericLiteral' && rightVal.value === 0);
        if (isZero) {
          const array = this.transformExpression(node.left.array);
          return new PythonCall(
            new PythonMemberAccess(array, 'clear'),
            []
          );
        }
        // For non-zero length assignment, use slice assignment: arr[:] = arr[:n]
        const array = this.transformExpression(node.left.array);
        const newLen = this.transformExpression(node.right);
        return new PythonAssignment(
          new PythonSubscript(array, new PythonSlice(null, null)),
          new PythonSubscript(array, new PythonSlice(null, newLen))
        );
      }

      // Handle MemberExpression with .length on left side (JavaScript pattern)
      if (node.left && node.left.type === 'MemberExpression' &&
          node.left.property && node.left.property.name === 'length' && node.operator === '=') {
        const rightVal = node.right;
        const isZero = (rightVal.type === 'Literal' && rightVal.value === 0) ||
                       (rightVal.type === 'NumericLiteral' && rightVal.value === 0);
        if (isZero) {
          const array = this.transformExpression(node.left.object);
          return new PythonCall(
            new PythonMemberAccess(array, 'clear'),
            []
          );
        }
      }

      // Handle chained assignments: a = b = c = value
      // Only simple assignments (=) can be chained; compound assignments (+=, -=, etc.) cannot
      let target, value;

      if (node.operator === '=') {
        // Check for chained simple assignments
        const targets = [];
        let currentNode = node;

        // Walk the chain from outermost to innermost, collecting targets
        while (currentNode.type === 'AssignmentExpression' && currentNode.operator === '=') {
          targets.push(currentNode.left);
          if (currentNode.right.type === 'AssignmentExpression' && currentNode.right.operator === '=') {
            currentNode = currentNode.right;
          } else {
            break;
          }
        }

        // Now currentNode.right is the final value (not a simple assignment)
        // Transform the final value first (before transforming targets that might have side effects)

        // Handle UpdateExpression (++/--) as the right side value
        const isUpdateExpr = (n) => n && (n.type === 'UpdateExpression' ||
          (n.type === 'UnaryExpression' && (n.operator === '++' || n.operator === '--')));

        let finalValue;
        if (isUpdateExpr(currentNode.right)) {
          // For code++: use current value, then increment
          // For ++code: increment, then use new value
          const rightNode = currentNode.right;
          const updateTarget = this.transformExpression(rightNode.argument);
          const one = PythonLiteral.Int(1);
          const op = rightNode.operator === '++' ? '+=' : '-=';
          const updateStmt = new PythonAssignment(updateTarget, one);
          updateStmt.operator = op;
          updateStmt.isAugmented = true;

          if (rightNode.prefix) {
            // Prefix ++x: increment first, then use new value
            if (!this.pendingPreStatements) this.pendingPreStatements = [];
            this.pendingPreStatements.push(updateStmt);
            finalValue = this.transformExpression(rightNode.argument);
          } else {
            // Postfix x++: use current value, then increment
            this.pendingPostStatements.push(updateStmt);
            finalValue = this.transformExpression(rightNode.argument);
          }
        } else {
          finalValue = this._transformExpressionAsRead(currentNode.right);
        }

        // Transform all targets (outermost first, which corresponds to evaluation order)
        // Side effects (like subscript increments) will be collected in pendingPostStatements
        // Array-literal targets ([a, b] = [b, c]) must become a tuple target, not a
        // JSArray(...) call - JSArray wraps list *values*, but a function call can't
        // be an assignment target in Python.
        const transformedTargets = targets.map(t => this.transformAssignmentTargetExpression(t));

        // The outermost target (index 0) becomes the main assignment target
        target = transformedTargets[0];
        value = finalValue;

        // If there are multiple targets (chained assignment), create sequential assignments
        // In JavaScript: a = b = c = value means c=value, b=value, a=value (right to left)
        // We emit the inner assignments (right to left, innermost first) as pre-statements.
        // IMPORTANT: hoist finalValue into a temp variable and assign THAT to every
        // target, rather than re-emitting the finalValue expression tree once per
        // target. JS evaluates the RHS expression exactly once and reuses that value
        // for every target in the chain - but when the RHS is self-referential (reads
        // one of the chain's own targets, e.g. serpent.js's
        // `wo[0] = w[idx] = RotL32(Xor(..., w[idx]), 11)`), re-emitting the same
        // source expression for each target statement makes the later statement(s)
        // read the ALREADY-mutated target instead of the original value, silently
        // computing a different (wrong) result each time.
        if (transformedTargets.length > 1) {
          if (!this._chainAssignCounter) this._chainAssignCounter = 0;
          const tempIdent = new PythonIdentifier(`_chain_assign_${++this._chainAssignCounter}`);
          if (!this.pendingPreStatements) this.pendingPreStatements = [];
          this.pendingPreStatements.push(new PythonAssignment(tempIdent, finalValue));
          // Emit innermost first, then work outward (but skip the outermost which is our main assignment)
          for (let i = transformedTargets.length - 1; i > 0; --i) {
            const innerTarget = transformedTargets[i];
            const innerAssignment = new PythonAssignment(innerTarget, tempIdent);
            this.pendingPreStatements.push(innerAssignment);
          }
          value = tempIdent;
        }
      } else {
        // Compound assignment (+=, -=, etc.) - cannot be chained
        target = this.transformExpression(node.left);
        value = this._transformExpressionAsRead(node.right);
      }

      // Handle unsigned right shift assignment (>>>=)
      // Python doesn't have >>>=, so convert x >>>= n to x = (x >> n) & 0xFFFFFFFF
      if (node.operator === '>>>=') {
        const targetAgain = this.transformExpression(node.left);
        const shift = new PythonBinaryExpression(targetAgain, '>>', value);
        const masked = new PythonBinaryExpression(shift, '&', PythonLiteral.Int(0xFFFFFFFF));
        return new PythonAssignment(target, masked);
      }

      const assignment = new PythonAssignment(target, value);
      assignment.operator = node.operator;
      assignment.isAugmented = node.operator !== '=';

      // Remember `this.<name>` properties we just proved are integer-valued
      // (see the isFloatOperand doc comment in transformBinaryExpression's
      // '/' handling for why: the shared type-aware parser tags a variable
      // 'float' merely because it was assigned from a `/` expression,
      // regardless of whether THIS codegen chose plain `/` or exact `//` for
      // that expression - e.g. sparkle.js's `this.RATE_WORDS = config.RATE_BYTES
      // / 4` floor-divides fine here, but every LATER `this.RATE_WORDS / 2`
      // still trusted the stale 'float' tag and kept real division, turning
      // an array-index computation into a float that IndexError's).
      if (node.operator === '=' && node.left) {
        // `this.<name>` reaches here as either the raw parsed MemberExpression
        // shape, OR (far more commonly - see type-aware-transpiler.js's
        // _transformMemberExpression) already normalized to the IL
        // 'ThisPropertyAccess' node, whose `.property` is a plain string
        // rather than a nested Identifier/Literal node.
        let rawPropName = null;
        if (node.left.type === 'ThisPropertyAccess' && !node.left.computed) {
          rawPropName = node.left.property;
        } else if (node.left.type === 'MemberExpression' && !node.left.computed &&
                   node.left.object && node.left.object.type === 'ThisExpression') {
          rawPropName = node.left.property.name || node.left.property.value;
        }
        if (rawPropName && this._isIntegerProducingPyExpr(value)) {
          this._knownIntThisProps.add(rawPropName);
        }
      }

      return assignment;
    }

    /**
     * True when a transformed Python expression is guaranteed to produce an
     * int (used to correct the shared parser's coarser 'float' type tag -
     * see the _knownIntThisProps comment above).
     */
    _isIntegerProducingPyExpr(n) {
      if (!n) return false;
      if (n instanceof PythonBinaryExpression && n.operator === '//') return true;
      if (n instanceof PythonLiteral && n.literalType === 'int') return true;
      if (n instanceof PythonCall && n.callee instanceof PythonIdentifier && n.callee.name === 'int') return true;
      return false;
    }

    /**
     * Transform object destructuring assignment to sequential assignments
     * ({a: x, b: y} = source) becomes:
     *   _result = source
     *   x = _result["a"]
     *   y = _result["b"]
     */
    transformObjectDestructuringAssignment(node) {
      const source = this.transformExpression(node.right);
      const properties = node.left.properties || [];

      // Create a temp variable name (unique per call)
      if (!this._destructuringCounter) this._destructuringCounter = 0;
      const tempName = `_destruct_${++this._destructuringCounter}`;
      const tempIdent = new PythonIdentifier(tempName);

      // Create the statements
      const statements = [];

      // First: assign source to temp variable
      statements.push(new PythonAssignment(tempIdent, source));

      // Then: for each property, assign temp["key"] to target
      for (const prop of properties) {
        // Get the key name (the property name in the object)
        const keyName = prop.key?.name || prop.key?.value || (typeof prop.key === 'string' ? prop.key : null);
        if (!keyName) continue;

        // Get the target (what we're assigning to)
        // Could be an identifier or a member expression like v[0]
        const target = this.transformExpression(prop.value || prop.key);

        // The object literal this destructures FROM (JSObject({...}), built
        // by transformObjectExpression) keys every non-literal property
        // through toSnakeCaseProperty (e.g. argon2.js's `{ Dh, Dl }` becomes
        // JSObject({"dh": ..., "dl": ...})) - the read-back subscript here
        // must fold the same way, or a destructure of a differently-cased
        // key (like `Dh`) misses the lowercased key entirely and silently
        // reads back None instead of raising (argon2.js's `({ Dh, Dl } = {
        // Dh: ..., Dl: ... })` then feeds that None straight into further
        // arithmetic - "int() argument ... not NoneType").
        const snakeKeyName = prop.keyIsLiteral ? keyName : toSnakeCaseProperty(keyName);
        const dictAccess = new PythonSubscript(
          new PythonIdentifier(tempName),
          PythonLiteral.Str(snakeKeyName)
        );
        statements.push(new PythonAssignment(target, dictAccess));
      }

      // Return a block containing all statements
      // Note: This is returned from an expression context, so the caller needs to handle it
      const block = new PythonBlock();
      block.statements = statements;
      return block;
    }

    transformMemberExpression(node) {
      // Handle global.X pattern - strip the global. prefix
      // JavaScript's `global.OpCodes` or `global.AlgorithmFramework` should become just `OpCodes` or `AlgorithmFramework`
      // These are available in the Python runtime helpers
      if (node.object.type === 'Identifier' &&
          (node.object.name === 'global' || node.object.name === 'globalThis')) {
        const propName = node.property.name || node.property.value;
        // Return just the property name - OpCodes, AlgorithmFramework, etc.
        // These are available as globals in the Python runtime
        if (propName === 'OpCodes') {
          return new PythonIdentifier('OpCodes');
        }
        if (propName === 'AlgorithmFramework') {
          return new PythonIdentifier('AlgorithmFramework');
        }
        // Other global properties (`global.Cipher`, `global.CipherMetadata`,
        // `global.RegisterAlgorithm`, ...) - legacy/optional globals this
        // codebase's UMD boilerplate feature-detects
        // (`if (global.Cipher) { global.Cipher.Add(...); }`,
        // `global.CipherMetadata ? global.CipherMetadata.createMetadata(...)
        // : ...`) that are never actually bound as Python names, unlike
        // OpCodes/AlgorithmFramework above. A bare snake_case identifier
        // reference NameErrors the instant it's read (no declared `cipher`/
        // `cipher_metadata` exists) - even for a guard whose condition
        // exists precisely to make the access safe when absent.
        // `globals().get(name)` mirrors JS's actual runtime answer for a
        // never-defined global (falls back to None, same as JS's
        // `undefined`) while still resolving correctly the one case a bare
        // name IS reachable: `global.RegisterAlgorithm` aliases the very
        // real module-level `register_algorithm()` stub also emitted for
        // the `AlgorithmFramework.RegisterAlgorithm` idiom.
        // Assignment TARGETS (`global.DEAL = DEAL`) must NOT reach this -
        // see transformAssignmentTargetExpression's own earlier intercept.
        return new PythonCall(
          new PythonMemberAccess(new PythonCall(new PythonIdentifier('globals'), []), 'get'),
          [PythonLiteral.Str(toSnakeCase(propName))]
        );
      }

      // Known enum objects from AlgorithmFramework
      const ENUM_OBJECTS = new Set([
        'CategoryType', 'SecurityStatus', 'ComplexityType', 'CountryCode'
      ]);

      // Known framework classes that should be used directly (not via AlgorithmFramework.)
      // Includes every Algorithm/Instance base class stubbed by
      // generateFrameworkStubs() (see FRAMEWORK_ALGORITHM_BASES/
      // FRAMEWORK_INSTANCE_BASES) - a common
      // `var AeadAlgorithm = AlgorithmFramework.AeadAlgorithm;` extraction
      // idiom otherwise fell through to a plain attribute access that the
      // AlgorithmFramework stub class never defines.
      const FRAMEWORK_TYPES = new Set([
        'KeySize', 'LinkItem', 'Vulnerability', 'TestCase',
        ...FRAMEWORK_ALGORITHM_BASES, ...FRAMEWORK_INSTANCE_BASES
      ]);

      // Handle AlgorithmFramework.X pattern - strip the AlgorithmFramework. prefix
      // e.g., AlgorithmFramework.CategoryType.BLOCK -> category_type.BLOCK
      // e.g., AlgorithmFramework.KeySize -> KeySize
      if (node.object.type === 'Identifier' && node.object.name === 'AlgorithmFramework') {
        const propName = node.property.name || node.property.value;

        // Track for stub generation
        this.frameworkFunctions.add('algorithm_framework');

        // For enums like AlgorithmFramework.CategoryType, return the enum identifier
        if (ENUM_OBJECTS.has(propName)) {
          this.enumsUsed.add(toSnakeCase(propName));
          return new PythonIdentifier(toSnakeCase(propName));
        }

        // For helper classes like AlgorithmFramework.KeySize, AlgorithmFramework.LinkItem
        if (FRAMEWORK_TYPES.has(propName)) {
          this.helperClasses.add(propName);
          return new PythonIdentifier(propName);
        }

        // For other AlgorithmFramework properties (e.g. AlgorithmFramework.Find),
        // keep the object reference - it's a real attribute/method on the
        // AlgorithmFramework stub class, not a standalone global.
        return new PythonMemberAccess(new PythonIdentifier('AlgorithmFramework'), toSnakeCaseProperty(propName));
      }

      // Handle AlgorithmFramework.X.Y pattern (nested, like AlgorithmFramework.CategoryType.BLOCK)
      // When object is itself a MemberExpression with AlgorithmFramework as the outermost object
      if (node.object.type === 'MemberExpression' &&
          node.object.object.type === 'Identifier' &&
          node.object.object.name === 'AlgorithmFramework') {

        const middleProp = node.object.property.name || node.object.property.value;
        const outerProp = node.property.name || node.property.value;

        // Track for stub generation
        this.frameworkFunctions.add('algorithm_framework');

        // For enum constants like AlgorithmFramework.CategoryType.BLOCK
        if (ENUM_OBJECTS.has(middleProp)) {
          this.enumsUsed.add(toSnakeCase(middleProp));
          // Return enum_object.CONSTANT (keep constant uppercase)
          return new PythonMemberAccess(
            new PythonIdentifier(toSnakeCase(middleProp)),
            outerProp  // Keep enum constant in original case
          );
        }

        // For other nested access, convert both parts
        return new PythonMemberAccess(
          new PythonIdentifier(toSnakeCase(middleProp)),
          toSnakeCase(outerProp)
        );
      }

      // Check if accessing enum constant (keep UPPERCASE)
      let isEnumAccess = node.object.type === 'Identifier' && ENUM_OBJECTS.has(node.object.name);

      // Track enum usage for stub generation (before snake_case conversion)
      if (isEnumAccess)
        this.enumsUsed.add(toSnakeCase(node.object.name));

      const object = this.transformExpression(node.object);

      // The raw-node check above only catches direct `CategoryType.BLOCK` /
      // `AlgorithmFramework.CategoryType.BLOCK`. Longer prefixed chains like
      // `global.AlgorithmFramework.CategoryType.BLOCK` resolve node.object to
      // a nested MemberExpression at every level, so the shape-based check
      // never matches. Fall back to inspecting what node.object actually
      // transformed *to*: if it's one of the enum singleton identifiers,
      // this is still enum-constant access and the property case must be preserved.
      if (!isEnumAccess) {
        const ENUM_SNAKE_NAMES = new Set(['category_type', 'security_status', 'complexity_type', 'country_code']);
        if (object instanceof PythonIdentifier && ENUM_SNAKE_NAMES.has(object.name)) isEnumAccess = true;
        // e.g. AlgorithmFramework.category_type (a PythonMemberAccess, from the
        // `global.AlgorithmFramework.CategoryType` intermediate resolution above)
        else if (object instanceof PythonMemberAccess && ENUM_SNAKE_NAMES.has(object.attribute)) isEnumAccess = true;
      }

      if (node.computed) {
        // Computed access: obj[prop]
        // Handle UpdateExpression, UnaryExpression (++/--), and AssignmentExpression specially - Python doesn't support these in subscripts
        let property;
        const prop = node.property;
        const isUpdate = prop.type === 'UpdateExpression' ||
                        (prop.type === 'UnaryExpression' && (prop.operator === '++' || prop.operator === '--'));

        if (isUpdate) {
          if (!prop.prefix) {
            // Postfix i++ or i--: use current value, then add increment/decrement as post-statement
            const target = this.transformExpression(prop.argument);
            const one = PythonLiteral.Int(1);
            const op = prop.operator === '++' ? '+=' : '-=';
            if (!this.pendingPostStatements) this.pendingPostStatements = [];
            // A SECOND (or third, ...) `arr[i++]` reading the SAME `i`
            // within one statement (e.g. compression/pithy.js's copy-offset
            // decode, `input[ip++] | (input[ip++] << 8)` - two DIFFERENT
            // successive bytes, low then high) must read one past the
            // PRIOR occurrence's value: every increment here is deferred to
            // a POST-statement that only runs once, after the ENTIRE
            // containing statement finishes - so `ip`'s actual Python
            // variable hasn't advanced yet by the time this later occurrence
            // reads it, even though JS's own left-to-right evaluation would
            // already have applied the earlier occurrence's side effect.
            // Count how many not-yet-flushed postfix increments for this
            // same target are already queued (each represents exactly one
            // such earlier occurrence still pending) and read `target + N`
            // instead of the bare `target` when N > 0 - this reproduces the
            // correct VALUE without needing to restructure statement
            // execution order, since a lone (N === 0) occurrence - the
            // overwhelmingly common case - is completely unaffected (falls
            // through to the original bare-identifier read below).
            const isSamePendingIncrement = (stmt) => stmt instanceof PythonAssignment && stmt.isAugmented &&
              stmt.operator === op && stmt.target instanceof PythonIdentifier &&
              target instanceof PythonIdentifier && stmt.target.name === target.name &&
              stmt.value instanceof PythonLiteral && stmt.value.value === 1;
            const priorCount = this.pendingPostStatements.filter(isSamePendingIncrement).length;
            const postIncrement = new PythonAssignment(target, one);
            postIncrement.operator = op;
            postIncrement.isAugmented = true;
            this.pendingPostStatements.push(postIncrement);
            // Use current value (offset by any already-queued-but-not-yet-
            // applied same-target increments) as the subscript index
            const currentValue = this.transformExpression(prop.argument);
            property = priorCount > 0
              ? new PythonBinaryExpression(currentValue, prop.operator === '++' ? '+' : '-', PythonLiteral.Int(priorCount))
              : currentValue;
          } else {
            // Prefix ++i or --i: increment first (add as pre-statement), then use new value
            const target = this.transformExpression(prop.argument);
            const one = PythonLiteral.Int(1);
            const op = prop.operator === '++' ? '+=' : '-=';
            const preIncrement = new PythonAssignment(target, one);
            preIncrement.operator = op;
            preIncrement.isAugmented = true;
            if (!this.pendingPreStatements) this.pendingPreStatements = [];
            this.pendingPreStatements.push(preIncrement);
            // Use new value as the subscript index
            property = this.transformExpression(prop.argument);
          }
        } else if (prop.type === 'AssignmentExpression') {
          // For assignments in subscripts, add as pre-statement and use assigned value
          const assignment = this.transformAssignmentExpression(prop);
          if (!this.pendingPreStatements) this.pendingPreStatements = [];
          this.pendingPreStatements.push(assignment);
          property = this.transformAssignmentExpressionForExpression(prop, true);
        } else {
          property = this.transformExpression(prop);
        }
        return new PythonSubscript(object, property);
      } else {
        // Dot access: obj.prop
        const propName = node.property.name || node.property.value;

        // A bare `OpCodes.Method` reference used as a VALUE rather than
        // immediately called (e.g. echo.js's AES table-generation idiom
        // `OpCodes.Pack32LE.apply(null, OpCodes.Unpack32BE(x))`, where the
        // outer `.apply` call's own object operand is `OpCodes.Pack32LE`)
        // reaches this generic dot-access path instead of the dedicated
        // 'OpCodesCall'/direct-call handling (transformOpCodesCall,
        // reached only when OpCodes.Method(...) is itself the call being
        // made) - toSnakeCaseProperty below would fold it to `pack32_le`,
        // which the Python OpCodes port (PascalCase throughout, matching
        // OpCodes.js) has no such attribute for. Keep every OpCodes.* member
        // read in its original PascalCase spelling, matching
        // transformOpCodesCall's own untouched `methodName`.
        if (node.object && node.object.type === 'Identifier' && node.object.name === 'OpCodes') {
          return new PythonMemberAccess(object, escapePythonKeyword(propName));
        }

        // Handle special property mappings
        if (propName === 'length') {
          return new PythonCall(new PythonIdentifier('_js_len'), [object]);
        }
        // Map/Set .size -> len(x). Only when the receiver is known (via the
        // shared parser's type tracking) to actually be a Set/Map - a plain
        // object/class instance legitimately carrying its own `size` field
        // (block size, matrix size, etc. - common across this codebase) must
        // keep plain attribute access instead, or this would silently
        // replace a stored integer with a call to len() on it.
        if (propName === 'size' && node.object && (node.object.resultType === 'Set' || node.object.resultType === 'Map')) {
          return new PythonCall(new PythonIdentifier('len'), [object]);
        }

        // Keep enum constants UPPERCASE, convert other properties to snake_case.
        // Attribute names never shadow builtins in Python (self.input doesn't
        // hide the input() builtin the way a local variable would), so only
        // true keywords need escaping here - see toSnakeCaseProperty().
        let property = isEnumAccess ? propName : toSnakeCaseProperty(propName);

        // Check for a field/method collision when accessing this.xxx (object
        // is 'self') that is an ARTIFACT OF SNAKE-CASE FOLDING - only rename
        // when the raw (pre-snake-case) JS property name being read differs
        // from every raw method name that folds to the same snake_case
        // bucket (e.g. this.result - a plain field - vs a differently-cased
        // base-class this.Result() method: two distinct JS identifiers that
        // only collide after Python's lowercasing). When the raw spelling is
        // the exact same JS identifier as an existing method, this is a bare
        // `this.method` reference to that method as a first-class value
        // (e.g. haval.js's `const fpFunctions = [this.fp3_1, this.fp3_2,
        // ...]`, dispatched later via `fpFunc.call(this, ...)`) - it must
        // resolve to the real bound method (matching Python's own
        // instance-shadows-method descriptor semantics, identical to JS's
        // own prototype-chain shadowing), not a `_method_value` attribute
        // nothing ever assigns (silently None - "'NoneType' object is not
        // callable"/"'list' object is not callable" the instant it's used).
        if (node.object.type === 'ThisExpression' && this.currentClassMethodNames) {
          const rawNames = this.currentClassMethodNames.get(property);
          if (rawNames && !rawNames.has(propName)) {
            property = '_' + property + '_value';
          } else if (this.currentMethodNameOverrides && this.currentMethodNameOverrides.has(propName)) {
            // Two distinct real methods collide onto the same folded name
            // (see the currentMethodNameOverrides comment in
            // transformClassDeclaration) - resolve to this raw name's own
            // disambiguated method instead of the (different) method that
            // happens to own the plain folded name.
            property = this.currentMethodNameOverrides.get(propName);
          }
        }

        // Check for backing field access inside a getter/setter
        // This handles patterns like:
        //   get outputSize() { return this.OutputSize; }  // JS uses different case for backing field
        //   set outputSize(value) { this.OutputSize = value; }
        // Both outputSize and OutputSize map to output_size in Python, causing infinite recursion
        // We convert such accesses to self._property_name_backing - but ONLY
        // when the JS spelling actually differs (OutputSize vs outputSize);
        // when it's the exact same identifier (propName === the raw,
        // un-snake-cased getter/setter name), this is a deliberate recursive
        // self-reassignment re-dispatching on a different runtime type (see
        // the currentPropertyNameRaw comment in transformMethodDefinition),
        // and must keep hitting the real property/setter, not a backing
        // field nothing else reads.
        if (node.object.type === 'ThisExpression' &&
            this.currentPropertyName &&
            property === this.currentPropertyName &&
            propName !== this.currentPropertyNameRaw) {
          property = '_' + property + '_backing';
        }

        // A plain local-variable object read (e.g. `config.permutation`
        // where `config = this._getVariantConfig(variant)` returns a
        // per-variant object literal that doesn't always define every
        // property - see aead/tinyjambu.js's `this.permutation =
        // config.permutation`, undefined for every variant there) needs
        // the same "missing property reads as JS `undefined`" leniency
        // _safeLogicalMemberOperand already gives &&/|| operands. Only
        // rewrite to `getattr(obj, 'prop', None)` when the caller has
        // marked this an unambiguous VALUE READ via
        // `this._memberReadWrapEnabled` (set narrowly around variable
        // initializers / plain assignment RHS - see those callers' own
        // comments) - this same transformMemberExpression is also reached,
        // through plain transformExpression(), for assignment TARGETS and
        // ++/-- operands throughout the transformer (e.g.
        // transformAssignmentTargetExpression's fallback), where
        // `getattr(...) = value` would be a Python SyntaxError ("cannot
        // assign to function call"); opting in only at known-safe read
        // sites avoids having to thread a "which context is this" answer
        // through every one of those call sites individually.
        const NON_WRAPPABLE_MEMBER_OBJECTS = new Set([
          'OpCodes', 'AlgorithmFramework', 'JSObject', 'JSArray', 'JSUint8Array',
          'Math', 'JSON', 'console', 'Object', 'Array', 'Number', 'String',
          'Date', 'Symbol', 'Promise', 'Map', 'Set', 'RegExp', 'Error', 'performance',
          ...ENUM_OBJECTS
        ]);
        if (this._memberReadWrapEnabled && node.object.type === 'Identifier' && !NON_WRAPPABLE_MEMBER_OBJECTS.has(node.object.name)) {
          return new PythonCall(new PythonIdentifier('getattr'), [
            object,
            PythonLiteral.Str(property),
            PythonLiteral.None()
          ]);
        }

        return new PythonMemberAccess(object, property);
      }
    }

    transformCallExpression(node) {
      // Bare `Find(...)` call - the destructuring that would normally bind
      // this name (`const { ..., Find } = AlgorithmFramework;`, then called
      // as a bare identifier rather than `AlgorithmFramework.Find(...)` -
      // e.g. forkae.js's `Find(this.forkSkinnyVariant)`) never reaches this
      // plugin at all: type-aware-transpiler.js's shared IL builder filters
      // any `const { ... } = AlgorithmFramework` destructure out of the
      // statement list entirely before per-language transforms run (it
      // records the destructured names on `this.frameworkImports` for its
      // own use, out of reach here), leaving every later bare-`Find(...)`
      // call site with nothing defining `find` - NameError. Every OTHER
      // commonly-destructured member (AeadAlgorithm, TestCase, LinkItem,
      // ...) survives this the same way despite the identical dropped
      // declaration, only because those names happen to already be
      // separately, unconditionally emitted as global stub classes with
      // matching names (see FRAMEWORK_STUBS/HELPER_STUBS) - `Find` is the
      // one destructured member that isn't a class, so it has no such
      // fallback. Rewrite the call site directly instead (the call sites
      // themselves are ordinary CallExpressions the parser leaves alone).
      if (node.callee.type === 'Identifier' && node.callee.name === 'Find') {
        return new PythonCall(
          new PythonMemberAccess(new PythonIdentifier('AlgorithmFramework'), 'find'),
          node.arguments.map(arg => this.transformExpression(arg))
        );
      }

      // Immediately-invoked function expression with no parameters -
      // `(() => { const x = ...; ...; return x; })()` - used as a plain
      // expression rather than a variable declarator's initializer (e.g.
      // pithy.js's/perk.js's `expected: (() => { const result = [...]; ...;
      // return result; })()` test-data property value). The declarator
      // path (see transformVariableDeclaration's IIFE branch) has its own
      // handling; this covers every OTHER expression position. Without
      // this, the generic 'ArrowFunction' expression-transform case (see
      // its own comment) keeps only the trailing `return <expr>` and
      // silently drops every statement before it, so e.g. `const result =
      // [0x41]; result.push(...); return result;` becomes a bare
      // reference to `result` - which nothing ever defined here - raising
      // NameError. transformCallbackExpr already implements exactly this
      // "hoist a block body into a real helper function" pattern for
      // Array-method callbacks; reuse it directly with zero parameters.
      const isBlockBodiedIIFE = (fn) => fn && (fn.type === 'ArrowFunctionExpression' || fn.type === 'ArrowFunction' || fn.type === 'FunctionExpression') &&
        fn.body && fn.body.type === 'BlockStatement' && (!fn.params || fn.params.length === 0);
      if (isBlockBodiedIIFE(node.callee) && (!node.arguments || node.arguments.length === 0)) {
        return this.transformCallbackExpr(node.callee, []);
      }

      // Transform arguments, handling UpdateExpression, UnaryExpression (++/--), and AssignmentExpression specially
      // Python doesn't support i++, ++i, or i += n as expressions in function arguments
      const args = node.arguments.map(arg => {
        const isUpdate = arg.type === 'UpdateExpression' ||
                        (arg.type === 'UnaryExpression' && (arg.operator === '++' || arg.operator === '--'));
        if (isUpdate) {
          // For postfix increment/decrement, we need to:
          // 1. Use the current value in the function call
          // 2. Add increment/decrement as post-statement to execute after the call
          if (!arg.prefix) {
            // Postfix: n++ or n-- -> use n, then add n += 1 or n -= 1 after
            const target = this.transformExpression(arg.argument);
            const one = PythonLiteral.Int(1);
            const op = arg.operator === '++' ? '+=' : '-=';
            const postIncrement = new PythonAssignment(target, one);
            postIncrement.operator = op;
            postIncrement.isAugmented = true;
            this.pendingPostStatements.push(postIncrement);
            // Return just the variable (current value before increment)
            return this.transformExpression(arg.argument);
          }
          // Prefix: ++n or --n -> use n + 1 or n - 1
          return this.transformUpdateExpressionForExpression(arg);
        }
        if (arg.type === 'AssignmentExpression') {
          // For assignment expressions in function arguments:
          // foo(x = value) -> x = value; foo(x)   (for simple =)
          // foo(x += value) -> (original implementation)
          // Extract the assignment as a pre-statement and use the target value in the call
          const assignment = this.transformAssignmentExpression(arg);
          // Use unshift to add BEFORE any post-statements from other args
          if (!this.pendingPreStatements) this.pendingPreStatements = [];
          this.pendingPreStatements.push(assignment);
          // Return the value that was assigned (the right side of the assignment)
          return this.transformAssignmentExpressionForExpression(arg, true);
        }
        return this.transformExpression(arg);
      });

      if (node.callee.type === 'MemberExpression') {
        // global.Foo(...) / globalThis.Foo(...) - bare-global call form, e.g.
        // `global.RegisterAlgorithm(DEAL)` in the legacy
        // `(function(global) { ... })(global)` IIFE pattern (as opposed to
        // `AlgorithmFramework.Foo(...)`). node.callee.object here is the plain
        // Identifier `global`; transforming it on its own (as the generic
        // `target = this.transformExpression(node.callee.object)` below does)
        // escapes it to the reserved-word-safe `global_` (Python's `global`
        // keyword) with no memory of the `global.` prefix, leaving `target`
        // a dangling name nothing defines - `global_.register_algorithm(...)`
        // NameErrors before the call even happens. Resolve the *whole*
        // `global.Foo` access through transformMemberExpression(), which
        // already applies the `global.OpCodes` / `global.AlgorithmFramework`
        // / `global.<X>` fallback rules (emit the already-bound module-level
        // name) - one rule, applied consistently whether `global.Foo` is
        // read or called.
        if (node.callee.object.type === 'Identifier' &&
            (node.callee.object.name === 'global' || node.callee.object.name === 'globalThis')) {
          const resolvedCallee = this.transformMemberExpression(node.callee);
          return new PythonCall(resolvedCallee, args);
        }

        const target = this.transformExpression(node.callee.object);
        const methodName = node.callee.property.name || node.callee.property.value;

        // RegExp.prototype.test(str) - only meaningful on an actual regex
        // (literal /pattern/flags, which transformLiteral turns into
        // re.compile(...)); other `.test(...)` calls (e.g. custom methods
        // named "test") fall through to the generic method-call handling.
        if (methodName === 'test' && args.length === 1 && node.callee.object.regex) {
          return new PythonBinaryExpression(
            new PythonCall(new PythonMemberAccess(target, 'search'), [args[0]]),
            'is not',
            PythonLiteral.None()
          );
        }

        // String.prototype.match(regex) - only meaningful when the argument
        // is an actual regex literal (transformLiteral turned it into
        // re.compile(...)); other `.match(...)` calls (e.g. custom methods
        // named "match") fall through to the generic method-call handling.
        // JS `str.match(regex)` (no /g/ flag) behaves like `regex.exec(str)`:
        // it searches anywhere in the string (not anchored at index 0 unless
        // the pattern itself starts with ^) and returns a match array or
        // null. Python's `re.match()` anchors at the string start instead -
        // `re.search()` is the faithful equivalent, and returns a Match
        // object or None, which is truthy/falsy exactly like the JS array/
        // null result for the extremely common `if (x.match(/.../))` idiom
        // seen throughout this codebase (e.g. Dilithium/Falcon/SPHINCS+ key
        // parsing: `if (keyData.match(/^[235]$/))`).
        if (methodName === 'match' && args.length === 1 && node.arguments[0] && node.arguments[0].regex) {
          return new PythonCall(new PythonMemberAccess(args[0], 'search'), [target]);
        }

        // String.prototype.localeCompare(other) -> -1/0/1, e.g.
        // classical/columnar.js's `columns.sort((a, b) =>
        // a.letter.localeCompare(b.letter))` (alphabetic column-key
        // ordering). Not a recognized IL string-method node (no
        // 'StringTransform'/dedicated node type covers it), so without this
        // it falls all the way through to the generic method-call handling
        // below, which just snake_cases the method name into
        // `.locale_compare(...)` - AttributeError, since Python str has no
        // such method. `(a > b) - (a < b)` reproduces the same 3-way
        // -1/0/1 contract plain codepoint ordering gives for the ASCII-only
        // comparisons this codebase's classical ciphers actually perform
        // (real locale-aware collation is never exercised here).
        if (methodName === 'localeCompare' && args.length >= 1) {
          return new PythonBinaryExpression(
            new PythonBinaryExpression(target, '>', args[0]),
            '-',
            new PythonBinaryExpression(target, '<', args[0])
          );
        }

        // `str.split('')` reaching the generic method-call fallback here
        // instead of the dedicated StringSplit IL transform (see
        // transformStringSplit's matching comment for the full
        // reasoning - same bug, reached via a different path): the shared
        // type-aware-transpiler.js parser only emits a 'StringSplit' IL
        // node when it can prove the receiver's resultType is exactly
        // 'string' (see its `_transformStringMethod`'s `if (stringType
        // !== 'string') return null`), which a long `.replace().replace()`
        // chain or similar doesn't always keep tracked - falling through
        // to here with the receiver treated as an ordinary method-call
        // target instead. Python's `str.split('')` unconditionally raises
        // ValueError("empty separator") - JS's "explode into individual
        // characters" idiom has no such Python `.split()` equivalent;
        // `list(target)` is the direct one.
        if (methodName === 'split' && node.arguments.length === 1 &&
            node.arguments[0].type === 'Literal' && node.arguments[0].value === '') {
          return new PythonCall(new PythonIdentifier('list'), [target]);
        }

        // Check for OpCodes methods (including calls through a local alias,
        // e.g. `const OC = typeof OpCodes !== 'undefined' ? OpCodes : global.OpCodes`)
        if (node.callee.object.type === 'Identifier' &&
            (node.callee.object.name === 'OpCodes' ||
             this.opCodesAliases.has(toSnakeCase(node.callee.object.name)))) {
          return this.transformOpCodesCall(methodName, args);
        }

        // Track AlgorithmFramework usage for stub generation
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'AlgorithmFramework') {
          this.frameworkFunctions.add('algorithm_framework');

          // AlgorithmFramework.RegisterAlgorithm(...) - route to the same
          // module-level register_algorithm(algo) stub used for the
          // destructured bare-call form (const {RegisterAlgorithm} = ...).
          // Without this it becomes AlgorithmFramework.register_algorithm(...),
          // which doesn't exist on the AlgorithmFramework stub class.
          if (methodName === 'RegisterAlgorithm') {
            this.frameworkFunctions.add('register_algorithm');
            return new PythonCall(new PythonIdentifier('register_algorithm'), args);
          }
        }

        // Handle console methods (JavaScript console -> Python print)
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'console') {
          // console.log() -> print()
          if (methodName === 'log' || methodName === 'warn' || methodName === 'error' || methodName === 'info')
            return new PythonCall(new PythonIdentifier('print'), args);
          // console.time/timeEnd -> pass (no-op in Python)
          if (methodName === 'time' || methodName === 'timeEnd')
            return new PythonIdentifier('pass');
        }

        // Handle JSON methods (JavaScript JSON -> Python json)
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'JSON') {
          // JSON.stringify(obj) -> json.dumps(obj)
          // NOTE: in practice this branch is unreachable for a literal
          // `JSON.stringify(...)` call - type-aware-transpiler.js's shared
          // IL builder (see its `objectName === 'JSON'` handling) already
          // rewrites that call into a dedicated 'JsonSerialize' IL node
          // before this per-language transformer ever sees a CallExpression
          // for it (see the 'JsonSerialize' case in transformExpression's
          // switch, which is the real, reachable implementation and carries
          // the matching `_preserveJsonObjectKeys` key-preservation logic).
          // Kept here only as a defensive fallback for a `JSON.stringify`
          // call shape the IL builder doesn't recognize as static (e.g. a
          // dynamically-rebound `const J = JSON; J.stringify(...)`).
          if (methodName === 'stringify') {
            this.imports.add('json');
            return new PythonCall(new PythonMemberAccess(new PythonIdentifier('json'), 'dumps'), args.length > 0 ? [args[0]] : [],
              [
                { name: 'default', value: new PythonIdentifier('_json_default') },
                { name: 'separators', value: new PythonTuple([PythonLiteral.Str(','), PythonLiteral.Str(':')]) }
              ]);
          }
          // JSON.parse(str) -> json.loads(str)
          if (methodName === 'parse') {
            this.imports.add('json');
            return new PythonCall(new PythonMemberAccess(new PythonIdentifier('json'), 'loads'), args);
          }
        }

        // Handle Date methods (JavaScript Date -> Python datetime)
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'Date') {
          // Date.now() -> int(datetime.datetime.now().timestamp() * 1000)
          if (methodName === 'now') {
            this.imports.add('datetime');
            return new PythonCall(
              new PythonIdentifier('int'),
              [new PythonBinaryExpression(
                new PythonCall(
                  new PythonMemberAccess(
                    new PythonCall(
                      new PythonMemberAccess(
                        new PythonMemberAccess(new PythonIdentifier('datetime'), 'datetime'),
                        'now'
                      ),
                      []
                    ),
                    'timestamp'
                  ),
                  []
                ),
                '*',
                PythonLiteral.Int(1000)
              )]
            );
          }
        }

        // Handle performance methods (JavaScript performance -> Python time)
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'performance') {
          // performance.now() -> time.perf_counter() * 1000 (milliseconds, like JS)
          if (methodName === 'now') {
            this.imports.add('time');
            return new PythonBinaryExpression(
              new PythonCall(new PythonMemberAccess(new PythonIdentifier('time'), 'perf_counter'), []),
              '*',
              PythonLiteral.Int(1000)
            );
          }
        }

        // Handle Object methods (JavaScript built-ins)
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'Object') {
          // Object.freeze(x) -> x (Python doesn't have freeze, tuples are immutable but lists aren't)
          if (methodName === 'freeze' && args.length === 1)
            return args[0];
          // Object.keys(obj) -> _js_object_keys(obj) (see the IL 'ObjectKeys'
          // case's doc comment for why this can't be plain obj.keys() - this
          // branch is the identical fallback for a call shape the IL builder
          // doesn't recognize as static Object.keys, so it needs the same fix).
          if (methodName === 'keys' && args.length === 1)
            return new PythonCall(new PythonIdentifier('_js_object_keys'), [args[0]]);
          // Object.values(obj) -> _js_object_values(obj)
          if (methodName === 'values' && args.length === 1)
            return new PythonCall(new PythonIdentifier('_js_object_values'), [args[0]]);
          // Object.entries(obj) -> _js_object_entries(obj)
          if (methodName === 'entries' && args.length === 1)
            return new PythonCall(new PythonIdentifier('_js_object_entries'), [args[0]]);
          // Object.assign(target, source) -> {**target, **source} or target.update(source)
          if (methodName === 'assign' && args.length >= 2) {
            return new PythonCall(new PythonMemberAccess(args[0], 'update'), [args[1]]);
          }
        }

        // Handle Array static methods (JavaScript built-ins)
        // Note: Check for both original name 'Array' and snake_case 'array' in case of pre-transformation
        const objName = node.callee.object.type === 'Identifier' ? node.callee.object.name : null;

        // Handle Number static methods
        if (objName === 'Number' || objName === 'number' || objName === 'int') {
          // Number.isInteger(x) -> isinstance(x, int)
          if ((methodName === 'isInteger' || methodName === 'is_integer') && args.length === 1)
            return new PythonCall(new PythonIdentifier('isinstance'), [args[0], new PythonIdentifier('int')]);
          // Number.isNaN(x) -> math.isnan(x)
          if ((methodName === 'isNaN' || methodName === 'is_na_n') && args.length === 1) {
            this.imports.add('math');
            return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), 'isnan'), args);
          }
          // Number.isFinite(x) -> math.isfinite(x)
          if ((methodName === 'isFinite' || methodName === 'is_finite') && args.length === 1) {
            this.imports.add('math');
            return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), 'isfinite'), args);
          }
          // Number.parseFloat(x) -> float(x)
          if ((methodName === 'parseFloat' || methodName === 'parse_float') && args.length >= 1)
            return new PythonCall(new PythonIdentifier('float'), [args[0]]);
          // Number.parseInt(x) -> _js_parse_int(x) - see the transformCallExpression
          // 'parseInt' branch's doc comment for why a bare int() is wrong here.
          if ((methodName === 'parseInt' || methodName === 'parse_int') && args.length >= 1) {
            this.frameworkFunctions.add('_js_parse_int');
            return new PythonCall(new PythonIdentifier('_js_parse_int'), args.slice(0, 2));
          }
        }

        if (objName === 'Array' || objName === 'array') {
          // Array.from(x) -> list(x)
          if (methodName === 'from') {
            if (args.length === 1) {
              return new PythonCall(new PythonIdentifier('list'), [args[0]]);
            }
            // Array.from(x, mapFn) -> [mapFn(i) for i in x]
            // Special case: Array.from({length: n}, fn) -> [fn(_i) for _i in range(n)]
            if (args.length >= 2) {
              const firstArg = node.arguments[0];
              let iterable = args[0];

              // Check if first arg is {length: n} pattern
              if (firstArg && firstArg.type === 'ObjectExpression' && firstArg.properties) {
                const lengthProp = firstArg.properties.find(p =>
                  (p.key && (p.key.name === 'length' || p.key.value === 'length'))
                );
                if (lengthProp && lengthProp.value) {
                  // Use range(n) as the iterable
                  iterable = new PythonCall(
                    new PythonIdentifier('range'),
                    [this.transformExpression(lengthProp.value)]
                  );
                }
              }
              // Also check for JSObject pattern with length
              if (iterable.type === 'PythonCall' &&
                  iterable.func && iterable.func.name === 'JSObject') {
                // Already wrapped in JSObject - extract length if present
                const dictArg = iterable.args && iterable.args[0];
                if (dictArg && dictArg.type === 'PythonDict') {
                  const lengthEntry = dictArg.entries.find(e =>
                    e.key && (e.key.value === 'length' || e.key.name === 'length')
                  );
                  if (lengthEntry && lengthEntry.value) {
                    iterable = new PythonCall(
                      new PythonIdentifier('range'),
                      [lengthEntry.value]
                    );
                  }
                }
              }

              // Check if mapper function uses its parameter
              const mapper = args[1];
              const mapperNode = node.arguments[1];

              // If mapper is a parameterless arrow function, just call it directly
              if (mapperNode &&
                  (mapperNode.type === 'ArrowFunctionExpression' ||
                   mapperNode.type === 'FunctionExpression') &&
                  (!mapperNode.params || mapperNode.params.length === 0)) {
                // Parameterless function: use the lambda body directly
                // Use nodeType (not type) since PythonNode uses nodeType property
                return new PythonListComprehension(
                  (mapper.nodeType === 'Lambda' && mapper.body)
                    ? mapper.body
                    : new PythonCall(mapper, []),
                  new PythonIdentifier('_'),
                  iterable
                );
              }

              return new PythonListComprehension(
                new PythonCall(mapper, [new PythonIdentifier('_i')]),
                new PythonIdentifier('_i'),
                iterable
              );
            }
          }
          // Array.isArray(x) -> isinstance(x, (list, bytes, bytearray)) -
          // see the 'IsArrayCheck' case above (same rewrite, reached via a
          // different AST shape - a plain CallExpression instead of the
          // IL's dedicated IsArrayCheck node - for the same JS source
          // pattern) for why `list` alone is wrong here.
          if ((methodName === 'isArray' || methodName === 'is_array') && args.length === 1) {
            return new PythonCall(
              new PythonIdentifier('isinstance'),
              [args[0], new PythonTuple([new PythonIdentifier('list'), new PythonIdentifier('bytes'), new PythonIdentifier('bytearray')])]
            );
          }
        }

        // Handle TypedArray static methods (Uint8Array.from, Int32Array.from, etc.)
        // Note: Include both PascalCase and snake_case versions
        const typedArrayMap = {
          'Uint8Array': 'bytearray', 'uint8_array': 'bytearray',
          'Uint16Array': 'list', 'uint16_array': 'list',
          'Uint32Array': 'list', 'uint32_array': 'list',
          'Int8Array': 'bytearray', 'int8_array': 'bytearray',
          'Int16Array': 'list', 'int16_array': 'list',
          'Int32Array': 'list', 'int32_array': 'list',
          'Float32Array': 'list', 'float32_array': 'list',
          'Float64Array': 'list', 'float64_array': 'list'
        };
        if (objName && typedArrayMap[objName]) {
          // TypedArray.from(x) -> list(x) or bytearray(x) for Uint8Array
          if (methodName === 'from') {
            const targetType = typedArrayMap[objName];
            if (args.length === 1) {
              return new PythonCall(new PythonIdentifier(targetType), [args[0]]);
            }
            // TypedArray.from(x, mapFn) -> [mapFn(i) for i in x]
            // Special case: TypedArray.from({length: n}, fn) -> [fn(_i) for _i in range(n)]
            if (args.length >= 2) {
              const firstArg = node.arguments[0];
              let iterable = args[0];

              // Check if first arg is {length: n} pattern
              if (firstArg && firstArg.type === 'ObjectExpression' && firstArg.properties) {
                const lengthProp = firstArg.properties.find(p =>
                  (p.key && (p.key.name === 'length' || p.key.value === 'length'))
                );
                if (lengthProp && lengthProp.value) {
                  iterable = new PythonCall(
                    new PythonIdentifier('range'),
                    [this.transformExpression(lengthProp.value)]
                  );
                }
              }

              // Check if mapper function is parameterless
              const mapper = args[1];
              const mapperNode = node.arguments[1];
              if (mapperNode &&
                  (mapperNode.type === 'ArrowFunctionExpression' ||
                   mapperNode.type === 'FunctionExpression') &&
                  (!mapperNode.params || mapperNode.params.length === 0)) {
                // Use nodeType (not type) since PythonNode uses nodeType property
                return new PythonListComprehension(
                  (mapper.nodeType === 'Lambda' && mapper.body)
                    ? mapper.body
                    : new PythonCall(mapper, []),
                  new PythonIdentifier('_'),
                  iterable
                );
              }

              // For simple arrow functions like (value => value & 0xff), substitute directly
              const mapperFnNode = node.arguments[1];
              if (mapperFnNode &&
                  (mapperFnNode.type === 'ArrowFunctionExpression' ||
                   mapperFnNode.type === 'FunctionExpression') &&
                  mapperFnNode.params?.length === 1) {
                const paramName = mapperFnNode.params[0].name || mapperFnNode.params[0];
                const bodyNode = mapperFnNode.body?.type === 'BlockStatement'
                  ? (mapperFnNode.body.body?.[0]?.argument || mapperFnNode.body)
                  : mapperFnNode.body;

                // Create a modified AST where the parameter is replaced with _i
                const substitutedBody = this._substituteIdentifier(bodyNode, paramName, '_i');
                const bodyExpr = this.transformExpression(substitutedBody);

                return new PythonListComprehension(
                  bodyExpr,
                  new PythonIdentifier('_i'),
                  iterable
                );
              }

              // Fallback: call the mapper function on each element
              return new PythonListComprehension(
                new PythonCall(mapper, [new PythonIdentifier('_i')]),
                new PythonIdentifier('_i'),
                iterable
              );
            }
          }
        }

        // Handle String static methods
        if (objName === 'String' || objName === 'str') {
          // String.fromCharCode(x) -> chr(x) or ''.join(chr(c) for c in [a, b, ...])
          if (methodName === 'fromCharCode' || methodName === 'from_char_code') {
            // Check if the argument is a spread (...array) before transformation
            const hasSpread = node.arguments && node.arguments.length === 1 &&
                              node.arguments[0].type === 'SpreadElement';
            if (hasSpread) {
              // String.fromCharCode(...array) -> ''.join(chr(c) for c in array)
              const spreadArg = this.transformExpression(node.arguments[0].argument);
              return new PythonCall(
                new PythonMemberAccess(new PythonLiteral("''"), 'join'),
                [new PythonGeneratorExpression(
                  new PythonCall(new PythonIdentifier('chr'), [new PythonIdentifier('_c')]),
                  new PythonIdentifier('_c'),
                  spreadArg
                )]
              );
            }
            if (args.length === 1)
              return new PythonCall(new PythonIdentifier('chr'), args);
            // Multiple args: ''.join(chr(c) for c in [a, b, c, ...])
            return new PythonCall(
              new PythonMemberAccess(new PythonLiteral("''"), 'join'),
              [new PythonGeneratorExpression(
                new PythonCall(new PythonIdentifier('chr'), [new PythonIdentifier('_c')]),
                new PythonIdentifier('_c'),
                new PythonList(args)
              )]
            );
          }
          // String.fromCodePoint(x) -> chr(x) or ''.join(chr(c) for c in [a, b, ...])
          if (methodName === 'fromCodePoint' || methodName === 'from_code_point') {
            // Check if the argument is a spread (...array) before transformation
            const hasSpread = node.arguments && node.arguments.length === 1 &&
                              node.arguments[0].type === 'SpreadElement';
            if (hasSpread) {
              // String.fromCodePoint(...array) -> ''.join(chr(c) for c in array)
              const spreadArg = this.transformExpression(node.arguments[0].argument);
              return new PythonCall(
                new PythonMemberAccess(new PythonLiteral("''"), 'join'),
                [new PythonGeneratorExpression(
                  new PythonCall(new PythonIdentifier('chr'), [new PythonIdentifier('_c')]),
                  new PythonIdentifier('_c'),
                  spreadArg
                )]
              );
            }
            if (args.length === 1)
              return new PythonCall(new PythonIdentifier('chr'), args);
            return new PythonCall(
              new PythonMemberAccess(new PythonLiteral("''"), 'join'),
              [new PythonGeneratorExpression(
                new PythonCall(new PythonIdentifier('chr'), [new PythonIdentifier('_c')]),
                new PythonIdentifier('_c'),
                new PythonList(args)
              )]
            );
          }
        }

        // Handle Function.apply() pattern - especially String.fromCharCode.apply(null, array)
        if (methodName === 'apply' && args.length >= 2) {
          // Check if target is X.fromCharCode where X is String/str
          if (node.callee.object.type === 'MemberExpression') {
            const innerObj = node.callee.object.object;
            const innerMethod = node.callee.object.property.name || (node.callee.object.property.value);
            if (innerObj && innerObj.type === 'Identifier') {
              const innerObjName = innerObj.name;
              if ((innerObjName === 'String' || innerObjName === 'str' || innerObjName === 'string') &&
                  (innerMethod === 'fromCharCode' || innerMethod === 'from_char_code')) {
                // String.fromCharCode.apply(null, array) -> ''.join(chr(c) for c in array)
                const arrayArg = args[1];
                return new PythonCall(
                  new PythonMemberAccess(new PythonLiteral("''"), 'join'),
                  [new PythonGeneratorExpression(
                    new PythonCall(new PythonIdentifier('chr'), [new PythonIdentifier('_c')]),
                    new PythonIdentifier('_c'),
                    arrayArg
                  )]
                );
              }
            }
          }
          // Generic fn.apply(thisArg, argsArray) -> fn(*argsArray)
          // In Python, we can unpack the args list with * operator
          return new PythonCall(target, [new PythonUnaryExpression('*', args[1])]);
        }
        // Handle Function.call() pattern
        if (methodName === 'call' && args.length >= 1) {
          // fn.call(thisArg, arg1, arg2, ...) -> fn(arg1, arg2, ...)
          // Skip the thisArg (first argument) and pass the rest
          return new PythonCall(target, args.slice(1));
        }

        // Handle array methods
        if (methodName === 'push') {
          // Check if any argument is a spread element (arr.push(...data) -> arr.extend(data))
          const hasSpread = node.arguments.some(arg => arg.type === 'SpreadElement');
          if (hasSpread) {
            // Check if all arguments are spread elements
            const allSpread = node.arguments.every(arg => arg.type === 'SpreadElement');
            if (allSpread) {
              if (node.arguments.length === 1) {
                // arr.push(...data) -> arr.extend(data)
                const spreadArg = this.transformExpression(node.arguments[0].argument);
                return new PythonCall(new PythonMemberAccess(target, 'extend'), [spreadArg]);
              }
              // arr.push(...a, ...b, ...c) -> arr.extend(a + b + c)
              const spreadArgs = node.arguments.map(arg => this.transformExpression(arg.argument));
              let concatenated = spreadArgs[0];
              for (let i = 1; i < spreadArgs.length; ++i)
                concatenated = new PythonBinaryExpression(concatenated, '+', spreadArgs[i]);
              return new PythonCall(new PythonMemberAccess(target, 'extend'), [concatenated]);
            }
            // Mixed spread and non-spread: arr.push(x, ...y, z) -> complex
            // For now, handle by extending with concatenated lists
            const parts = node.arguments.map(arg => {
              if (arg.type === 'SpreadElement')
                return this.transformExpression(arg.argument);
              return new PythonList([this.transformExpression(arg)]);
            });
            let concatenated = parts[0];
            for (let i = 1; i < parts.length; ++i)
              concatenated = new PythonBinaryExpression(concatenated, '+', parts[i]);
            return new PythonCall(new PythonMemberAccess(target, 'extend'), [concatenated]);
          }
          // arr.push(x) -> arr.append(x)
          return new PythonCall(new PythonMemberAccess(target, 'append'), args);
        }
        if (methodName === 'pop') {
          return new PythonCall(new PythonMemberAccess(target, 'pop'), []);
        }
        if (methodName === 'slice') {
          if (args.length === 0) {
            return new PythonSubscript(target, new PythonSlice(null, null));
          } else if (args.length === 1) {
            return new PythonSubscript(target, new PythonSlice(args[0], null));
          } else {
            return new PythonSubscript(target, new PythonSlice(args[0], args[1]));
          }
        }
        if (methodName === 'concat') {
          return new PythonBinaryExpression(target, '+', args[0]);
        }
        if (methodName === 'fill') {
          // _js_fill (see its HELPER_STUBS doc comment) - mutates the
          // receiver in place, matching JS Array/TypedArray#fill(); the
          // previous `[value] * len(target)` built a disconnected new list
          // instead, a silent no-op for the common bare-statement idiom
          // `arr.fill(v);` on an already-declared array.
          return new PythonCall(new PythonIdentifier('_js_fill'), [target, ...args]);
        }

        // String/array methods
        if (methodName === 'indexOf') {
          // str.indexOf(x) -> str.find(x) for strings, list.index(x) for lists
          // Using find() is safer as it returns -1 on not found
          return new PythonCall(new PythonMemberAccess(target, 'find'), args);
        }
        if (methodName === 'charAt') {
          // str.charAt(i) -> str[i]
          return new PythonSubscript(target, args[0]);
        }
        if (methodName === 'charCodeAt') {
          // str.charCodeAt(i) -> ord(str[i])
          return new PythonCall(new PythonIdentifier('ord'), [new PythonSubscript(target, args[0])]);
        }
        if (methodName === 'fromCharCode' || methodName === 'from_char_code') {
          // String.fromCharCode(x) -> chr(x) or ''.join(chr(c) for c in [a, b, ...])
          // Check if the argument is a spread (...array) before transformation
          const hasSpread = node.arguments && node.arguments.length === 1 &&
                            node.arguments[0].type === 'SpreadElement';
          if (hasSpread) {
            // String.fromCharCode(...array) -> ''.join(chr(c) for c in array)
            const spreadArg = this.transformExpression(node.arguments[0].argument);
            return new PythonCall(
              new PythonMemberAccess(new PythonLiteral("''"), 'join'),
              [new PythonGeneratorExpression(
                new PythonCall(new PythonIdentifier('chr'), [new PythonIdentifier('_c')]),
                new PythonIdentifier('_c'),
                spreadArg
              )]
            );
          }
          if (args.length === 1)
            return new PythonCall(new PythonIdentifier('chr'), args);
          return new PythonCall(
            new PythonMemberAccess(new PythonLiteral("''"), 'join'),
            [new PythonGeneratorExpression(
              new PythonCall(new PythonIdentifier('chr'), [new PythonIdentifier('_c')]),
              new PythonIdentifier('_c'),
              new PythonList(args)
            )]
          );
        }
        if (methodName === 'length') {
          // Handled as property, not method
          return new PythonCall(new PythonIdentifier('_js_len'), [target]);
        }
        if (methodName === 'toString') {
          // num.toString(radix) - a non-decimal radix argument (see the
          // '_int_to_base' HELPER_STUBS entry's doc comment) needs actual
          // base conversion, not plain str() (always base 10).
          if (args.length >= 1) {
            return new PythonCall(new PythonIdentifier('_int_to_base'), [target, args[0]]);
          }
          return new PythonCall(new PythonIdentifier('str'), [target]);
        }
        if (methodName === 'toFixed') {
          // num.toFixed(digits) -> f"{num:.{digits}f}" or format(num, f".{digits}f")
          const digits = args.length > 0 ? args[0] : PythonLiteral.Int(0);
          // Use round for simplicity: str(round(num, digits))
          return new PythonCall(
            new PythonIdentifier('str'),
            [new PythonCall(new PythonIdentifier('round'), [target, digits])]
          );
        }
        if (methodName === 'join') {
          // arr.join(sep) -> sep.join(arr)
          if (args.length > 0) {
            return new PythonCall(new PythonMemberAccess(args[0], 'join'), [target]);
          }
          return new PythonCall(new PythonMemberAccess(PythonLiteral.Str(''), 'join'), [target]);
        }
        if (methodName === 'split') {
          // See transformStringSplit's matching comment: a regex-literal
          // separator becomes a compiled re.Pattern, whose own .split()
          // method (unlike str.split()) accepts a plain string - swap
          // operands instead of passing the Pattern as str.split()'s arg.
          const sepArgNode = node.arguments && node.arguments[0];
          if (sepArgNode && sepArgNode.type === 'Literal' && sepArgNode.regex && args.length > 0) {
            return new PythonCall(new PythonMemberAccess(args[0], 'split'), [target]);
          }
          return new PythonCall(new PythonMemberAccess(target, 'split'), args);
        }
        if (methodName === 'includes') {
          // arr.includes(x) -> x in arr
          return new PythonBinaryExpression(args[0], 'in', target);
        }
        if (methodName === 'has') {
          // map.has(key) or set.has(key) -> key in map/set
          return new PythonBinaryExpression(args[0], 'in', target);
        }
        if (methodName === 'delete' && args.length === 1) {
          // map.delete(key) - route through _map_delete rather than a
          // literal `target.delete(key)` attribute call: since
          // transformMapCreation (a real `new Map()`) now produces a plain
          // dict rather than a JSObject (see its doc comment), and plain
          // Python dicts have no .delete() method, only JSObject does.
          // _map_delete dispatches on the actual runtime type so both a
          // real Map (now a dict, pop()-based) and the pre-existing
          // JSObject-as-map idiom (delegates to JSObject's own .delete())
          // keep working through the same call site.
          return new PythonCall(new PythonIdentifier('_map_delete'), [target, args[0]]);
        }
        if (methodName === 'entries' && args.length === 0) {
          // map.entries() (zero-arg member call, e.g. `for (const [k, v] of
          // map.entries())`) -> target.items(). Both a real dict (produced
          // by transformMapCreation for `new Map()`) and JSObject (the
          // object-literal-as-map idiom) define .items() with identical
          // [key, value]-pairs semantics; only JSObject additionally
          // defines its own .entries() alias, so routing through .items()
          // uniformly (rather than leaving this to the generic
          // toSnakeCase(methodName) fallback below, which would call
          // .entries() directly - AttributeError on a plain dict) keeps
          // both target types working through one call site.
          return new PythonCall(new PythonMemberAccess(target, 'items'), []);
        }
        if (methodName === 'map') {
          // arr.map(fn) -> [fn(x) for x in arr] or [fn(x, i) for i, x in enumerate(arr)]
          const callbackNode = node.arguments[0];

          // Helper to extract map expression from callback body
          const getMapExprFromBody = (body, elemId, idxId) => {
            if (body.type === 'BlockStatement') {
              // Find the last return statement
              const returnStmt = body.body.find(s => s.type === 'ReturnStatement');
              if (returnStmt) {
                // Check if the block is simple (only contains return)
                // or if it has other statements
                if (body.body.length === 1 ||
                    (body.body.every(s => s.type === 'ReturnStatement' ||
                                          s.type === 'VariableDeclaration' ||
                                          s.type === 'ExpressionStatement'))) {
                  // Simple enough - extract return expression
                  return this.transformExpression(returnStmt.argument);
                }
              }
              // Complex block - can't convert to list comprehension
              // Fall back to list() + map() pattern
              return null;
            }
            // Simple expression body
            return this.transformExpression(body);
          };

          if (callbackNode &&
              (callbackNode.type === 'ArrowFunctionExpression' ||
               callbackNode.type === 'FunctionExpression')) {
            const body = callbackNode.body;
            const params = callbackNode.params || [];

            if (params.length >= 2) {
              // Two parameters: use enumerate for (index, element)
              // In JS it's (element, index), in Python enumerate gives (index, element)
              const elemParam = params[0].name || 'x';
              const idxParam = params[1].name || 'i';
              const elemId = new PythonIdentifier(toSnakeCase(elemParam));
              const idxId = new PythonIdentifier(toSnakeCase(idxParam));

              const mapExpr = getMapExprFromBody(body, elemId, idxId);
              if (mapExpr) {
                // [expr for i, elem in enumerate(arr)]
                const enumCall = new PythonCall(new PythonIdentifier('enumerate'), [target]);
                const tupleVar = new PythonTuple([idxId, elemId]);
                return new PythonListComprehension(mapExpr, tupleVar, enumCall);
              }
              // Complex body - use list(map(lambda, arr)) fallback
              const lambdaBody = this.transformExpression(body);
              const lambdaExpr = new PythonLambda([elemId, idxId], lambdaBody);
              return new PythonCall(
                new PythonIdentifier('list'),
                [new PythonCall(new PythonIdentifier('map'), [lambdaExpr, new PythonCall(new PythonIdentifier('enumerate'), [target])])]
              );
            } else {
              // Single parameter
              const elemParam = params[0]?.name || '_i';
              const elemId = new PythonIdentifier(toSnakeCase(elemParam));

              const mapExpr = getMapExprFromBody(body, elemId, null);
              if (mapExpr) {
                // [expr for elem in arr]
                return new PythonListComprehension(mapExpr, elemId, target);
              }
              // Complex body - transform the full function and use list(map())
              const transformedCallback = this.transformExpression(callbackNode);
              return new PythonCall(
                new PythonIdentifier('list'),
                [new PythonCall(new PythonIdentifier('map'), [transformedCallback, target])]
              );
            }
          }
          // Non-function callback (e.g., passing a function reference)
          return new PythonListComprehension(
            new PythonCall(args[0], [new PythonIdentifier('x')]),
            new PythonIdentifier('x'),
            target
          );
        }
        if (methodName === 'filter') {
          // arr.filter(fn) -> [x for x in arr if fn(x)]
          return new PythonListComprehension(
            new PythonIdentifier('x'),
            new PythonIdentifier('x'),
            target,
            new PythonCall(args[0], [new PythonIdentifier('x')])
          );
        }
        if (methodName === 'forEach') {
          // This should be a statement, not an expression - emit as a for loop comment
          this.warnings.push('forEach() converted to comment - use for loop instead');
          return new PythonIdentifier('None  # TODO: convert forEach to for loop');
        }
        // arr.findIndex(fn) - real Array.prototype.findIndex() calls are
        // normally recognized upstream (type-aware-transpiler.js's
        // _transformArrayMethod, gated on the receiver's inferred type
        // actually being an array) and routed to the dedicated
        // 'ArrayFindIndex' IL node / transformArrayFindIndex(), which
        // already exists and handles both 1- and 2-parameter callbacks
        // correctly - this fallback only fires when that type inference
        // couldn't confirm the receiver is an array (huffman.js's binary
        // heap - a plain JS array, but not one the upstream inferencer
        // tagged as such - hit exactly this, surfacing as "'JSArray' object
        // has no attribute 'find_index'" once the generic snake_case
        // fallback below took over). Mirror the SAME single-arrow/function-
        // argument guard _transformArrayMethod's own 'findIndex'/'find'
        // cases use before treating a call as Array.findIndex() - without
        // it, this would just as readily misfire on an unrelated custom
        // `.findIndex(...)`/`.find(...)` method taking a different argument
        // shape (compression/crush.js's `hashTable.find(buffer, pos,
        // maxLen)` - 3 plain args, not a single predicate callback - regressed
        // exactly this way during development of this fallback).
        const isSingleCallbackArg = node.arguments.length === 1 &&
          ['ArrowFunctionExpression', 'ArrowFunction', 'FunctionExpression', 'Function'].includes(node.arguments[0].type);
        if ((methodName === 'findIndex' || methodName === 'find_index') && isSingleCallbackArg) {
          // arr.findIndex(fn) -> next((i for i, x in enumerate(arr) if fn(x)), -1)
          // JS returns -1 when no element matches (never raises) - next()'s
          // default argument mirrors that instead of letting a plain
          // generator-with-no-match raise StopIteration.
          const elemId = new PythonIdentifier('_x');
          const idxId = new PythonIdentifier('_i');
          const genExpr = new PythonGeneratorExpression(
            idxId,
            new PythonTuple([idxId, elemId]),
            new PythonCall(new PythonIdentifier('enumerate'), [target]),
            new PythonCall(args[0], [elemId])
          );
          return new PythonCall(new PythonIdentifier('next'), [genExpr, PythonLiteral.Int(-1)]);
        }
        // String case conversion methods
        if (methodName === 'toUpperCase') {
          return new PythonCall(new PythonMemberAccess(target, 'upper'), []);
        }
        if (methodName === 'toLowerCase') {
          return new PythonCall(new PythonMemberAccess(target, 'lower'), []);
        }
        if (methodName === 'trim') {
          return new PythonCall(new PythonMemberAccess(target, 'strip'), []);
        }
        if (methodName === 'trimStart' || methodName === 'trimLeft') {
          return new PythonCall(new PythonMemberAccess(target, 'lstrip'), []);
        }
        if (methodName === 'trimEnd' || methodName === 'trimRight') {
          return new PythonCall(new PythonMemberAccess(target, 'rstrip'), []);
        }
        if (methodName === 'startsWith') {
          return new PythonCall(new PythonMemberAccess(target, 'startswith'), args);
        }
        if (methodName === 'endsWith') {
          return new PythonCall(new PythonMemberAccess(target, 'endswith'), args);
        }
        if (methodName === 'repeat') {
          // str.repeat(n) -> str * n
          return new PythonBinaryExpression(target, '*', args[0]);
        }
        if (methodName === 'padStart') {
          // str.padStart(len, fillChar) -> str.rjust(len, fillChar)
          return new PythonCall(new PythonMemberAccess(target, 'rjust'), args);
        }
        if (methodName === 'padEnd') {
          // str.padEnd(len, fillChar) -> str.ljust(len, fillChar)
          return new PythonCall(new PythonMemberAccess(target, 'ljust'), args);
        }
        if (methodName === 'replace' || methodName === 'replaceAll') {
          // Use safe_replace to handle None values like JavaScript
          const search = args[0] || PythonLiteral.Str('');
          const replacement = args[1] || PythonLiteral.Str('');
          const rawSearch = node.arguments && node.arguments[0];
          const isGlobal = methodName === 'replaceAll' ||
            !!(rawSearch && rawSearch.regex && rawSearch.regex.flags && rawSearch.regex.flags.includes('g'));
          return new PythonCall(new PythonIdentifier('safe_replace'), [target, search, replacement, PythonLiteral.Bool(isGlobal)]);
        }
        if (methodName === 'substring' || methodName === 'slice') {
          // str.substring(start, end) -> str[start:end]
          const start = args[0] || PythonLiteral.Int(0);
          const end = args.length > 1 ? args[1] : null;
          return new PythonSubscript(target, new PythonSlice(start, end));
        }
        if (methodName === 'substr') {
          // str.substr(start, length) -> str[start:start+length]
          const start = args[0] || PythonLiteral.Int(0);
          if (args.length > 1) {
            const end = new PythonBinaryExpression(start, '+', args[1]);
            return new PythonSubscript(target, new PythonSlice(start, end));
          }
          return new PythonSubscript(target, new PythonSlice(start, null));
        }

        // Map/dict-like .set(key, value) - not caught by the array/string/
        // DataView IL passes above when the receiver's type wasn't tracked
        // as 'Map' (falls all the way through to this generic method-call
        // fallback as a plain, untransformed CallExpression). Route through
        // _map_set rather than emitting target.set_(...) (methodName "set"
        // collides with the Python builtin `set`, so toSnakeCase escapes it
        // to "set_", which no dict/JSObject/custom class defines).
        // TypedArray.set(array, offset) also uses this method name but
        // always takes numeric offset as the 2nd arg where a Map .set()'s
        // 2nd arg is the value being stored - not reliably distinguishable
        // here, but plain dict/JSObject targets (the overwhelming majority
        // of `.set(k, v)` call sites reaching this generic fallback) are
        // correct either way since _map_set degrades to the same
        // subscript-assignment TypedArray.set would need for a dict target.
        if (methodName === 'set' && args.length === 2) {
          return new PythonCall(new PythonIdentifier('_map_set'), [target, args[0], args[1]]);
        }

        // Regular method call. A call rooted at OpCodes through more than
        // one member-access level (e.g. highway-hash.js's
        // `OpCodes.UInt64.fromNumber(...)`/`.rotl(...)`/`.add(...)`) never
        // matches the direct `OpCodes.Method(...)` alias check above (its
        // `node.callee.object` is the MemberExpression `OpCodes.UInt64`,
        // not the bare `OpCodes` Identifier) or the IL parser's own
        // `isOpCodesCall` detection (type-aware-transpiler.js's
        // _transformCallExpression - same one-level-only shape check), so
        // it falls all the way through to this generic fallback. Keep the
        // method name in its original JS casing here too (matching the
        // OpCodes-preservation branch in transformMemberExpression's
        // dot-access handling, and transformOpCodesCall's own untouched
        // methodName) instead of toSnakeCase-folding it to a name the
        // nested OpCodes.UInt64/UInt128 Python port classes don't define.
        let pyMethodName = this._isOpCodesRootedExpression(node.callee.object)
          ? escapePythonKeyword(methodName)
          : toSnakeCase(methodName);
        // this.method(...) calls go through this generic fallback rather than
        // transformMemberExpression's dot-access branch, so the same method-
        // name-collision disambiguation (see the currentMethodNameOverrides
        // comment in transformClassDeclaration - e.g. shacal-2.js's
        // `_Sigma0`/`_sigma0` colliding onto one snake_case name) needs to be
        // applied here too, or every `this._Sigma0(...)` call would silently
        // invoke the wrong (differently-cased) method.
        if (node.callee.object.type === 'ThisExpression' && this.currentMethodNameOverrides &&
            this.currentMethodNameOverrides.has(methodName)) {
          pyMethodName = this.currentMethodNameOverrides.get(methodName);
        }
        return new PythonCall(new PythonMemberAccess(target, pyMethodName), args);
      }

      // Handle super() calls
      if (node.callee.type === 'Super') {
        // super(args) in constructor -> super().__init__(args)
        return new PythonCall(
          new PythonMemberAccess(new PythonCall(new PythonIdentifier('super'), []), '__init__'),
          args
        );
      }

      // Known framework functions from AlgorithmFramework
      const FRAMEWORK_FUNCTIONS = new Set([
        'RegisterAlgorithm', 'register_algorithm'
      ]);

      // Track framework function usage for stub generation
      if (node.callee.type === 'Identifier' && FRAMEWORK_FUNCTIONS.has(node.callee.name))
        this.frameworkFunctions.add(toSnakeCase(node.callee.name));

      // Handle JavaScript global functions
      if (node.callee.type === 'Identifier') {
        const funcName = node.callee.name;
        // parseInt(x) / parseInt(x, base) - NOT a bare int(x)/int(x, base):
        // JS parseInt is lenient (skips leading whitespace, parses as many
        // leading valid digits as it can, silently ignoring any trailing
        // garbage, and returns NaN - never throws - if there isn't even one
        // valid leading digit). Python's int() is strict: ANY non-numeric
        // character anywhere in the string raises ValueError, aborting the
        // whole call instead of falling through to whatever fallback the
        // caller's own `parseInt(x) || default`/`isNaN(parsed) ? default :
        // parsed` idiom relies on (e.g. asymmetric/ml-dsa.js's KeySetup:
        // `parseInt("ML-DSA-44")` must yield NaN, matching `parseInt`'s own
        // real semantics, so the `[44,65,87].includes(NaN)` check falls
        // through to the already-defaulted parameter set instead of crashing
        // the whole KeySetup call before it ever reaches Init()).
        if (funcName === 'parseInt') {
          this.frameworkFunctions.add('_js_parse_int');
          return new PythonCall(new PythonIdentifier('_js_parse_int'), args.slice(0, 2));
        }
        // parseFloat(x) -> float(x)
        if (funcName === 'parseFloat')
          return new PythonCall(new PythonIdentifier('float'), args);
        // isNaN(x) -> math.isnan(x)
        if (funcName === 'isNaN') {
          this.imports.add('math');
          return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), 'isnan'), args);
        }
        // isFinite(x) -> math.isfinite(x)
        if (funcName === 'isFinite') {
          this.imports.add('math');
          return new PythonCall(new PythonMemberAccess(new PythonIdentifier('math'), 'isfinite'), args);
        }
        // Number(x) -> int(x) or float(x)
        if (funcName === 'Number')
          return new PythonCall(new PythonIdentifier('int'), args);
        // Boolean(x) -> bool(x)
        if (funcName === 'Boolean')
          return new PythonCall(new PythonIdentifier('bool'), args);
        // String(x) -> str(x)
        if (funcName === 'String')
          return new PythonCall(new PythonIdentifier('str'), args);
        // BigInt('0x...') or BigInt(num) -> int('0x...', 16) or int(num)
        // Python int() natively supports arbitrary precision (like JavaScript BigInt)
        // Note: This handles cases where BigInt() isn't pre-evaluated by type-aware-transpiler
        if (funcName === 'BigInt') {
          if (args.length === 1) {
            // Check if the argument is a hex string literal
            const arg = node.arguments[0];
            if (arg.type === 'Literal' && typeof arg.value === 'string' && arg.value.startsWith('0x')) {
              // BigInt('0x...') -> int('0x...', 16)
              return new PythonCall(new PythonIdentifier('int'), [args[0], PythonLiteral.Int(16)]);
            }
            // BigInt(x) where x isn't a literal known at transpile time to
            // be a hex string (e.g. a runtime-built string, or a plain
            // number/other BigInt) - route through _bigint(), which
            // auto-detects a "0x"/"0o"/"0b"-prefixed *string* the same way
            // JS's real BigInt() constructor does, and behaves exactly like
            // int(x) for anything else (see the '_bigint' HELPER_STUBS
            // entry's doc comment).
            return new PythonCall(new PythonIdentifier('_bigint'), args);
          }
          return new PythonCall(new PythonIdentifier('int'), args);
        }
      }

      // Simple function call
      const callee = this.transformExpression(node.callee);

      // Check if callee is super marker
      if (callee instanceof PythonIdentifier && callee.name === '__super__') {
        // This shouldn't happen with proper super handling above, but just in case
        return new PythonCall(
          new PythonMemberAccess(new PythonCall(new PythonIdentifier('super'), []), '__init__'),
          args
        );
      }

      return new PythonCall(callee, args);
    }

    /**
     * True when `node` is `OpCodes`, or a chain of non-computed dot-accesses
     * rooted at `OpCodes` (e.g. `OpCodes.UInt64`, `OpCodes.UInt64.someMethod`
     * read as a value rather than called - the nested-namespace shape
     * highway-hash.js's `OpCodes.UInt64.fromNumber(...)` etc. use). Shared by
     * the OpCodes-preservation logic in transformMemberExpression's
     * dot-access branch and the generic method-call fallback below, so a
     * method reached through more than one member-access level still keeps
     * its original JS casing instead of being folded to a nonexistent
     * snake_case attribute on the Python OpCodes port.
     */
    _isOpCodesRootedExpression(node) {
      if (!node) return false;
      if (node.type === 'Identifier') return node.name === 'OpCodes';
      if (node.type === 'MemberExpression' && !node.computed) return this._isOpCodesRootedExpression(node.object);
      return false;
    }

    transformOpCodesCall(methodName, args) {
      // A deeply nested chain of a 2-arg associative bitwise helper (e.g.
      // khazad.js's 5-deep `OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(...),
      // ...), roundKeyHi[ROUNDS])`) is sometimes folded upstream, by the
      // shared type-aware IL builder, into a single flattened expression
      // that already incorporates every operand - but the outermost call
      // node itself survives as a now-degenerate OpCodesCall with only ONE
      // remaining argument (everything else already absorbed into it),
      // instead of being replaced by the flattened expression too. Calling
      // the real 2-arg OpCodes.XorN with a single argument is a hard
      // TypeError ("missing 1 required positional argument: 'b'"). For
      // XorN specifically this is safe to special-case: XOR-folding a
      // single value with nothing else is that value unchanged (the
      // identity case of the same left-fold the nested calls already
      // represent), so just pass the lone argument through as-is.
      if (methodName === 'XorN' && args.length === 1) {
        return args[0];
      }

      // Route every OpCodes.* call through a single comprehensive Python port
      // of OpCodes.js (see the 'OpCodes' entry in generateFrameworkStubs),
      // rather than hand-translating a subset of methods to inline Python
      // operators here. This guarantees every method - including ones added
      // to OpCodes.js later - resolves to a real, semantically-correct
      // implementation instead of an undefined bare function call.
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('OpCodes'), methodName),
        args
      );
    }

    transformNewExpression(node) {
      const typeName = node.callee.name;

      // Handle TypedArray constructors with array literals
      const typedArrayMap = {
        'Uint8Array': 'bytes',
        'Uint16Array': 'array.array',
        'Uint32Array': 'array.array',
        'Int8Array': 'array.array',
        'Int16Array': 'array.array',
        'Int32Array': 'array.array',
        'Float32Array': 'array.array',
        'Float64Array': 'array.array'
      };

      if (typedArrayMap[typeName]) {
        const hasArrayInit = node.arguments.length > 0 &&
          node.arguments[0].type === 'ArrayExpression';

        if (hasArrayInit) {
          // new Uint8Array([1, 2, 3]) -> bytes([1, 2, 3]) or bytearray([1, 2, 3])
          const elements = node.arguments[0].elements.map(e => this.transformExpression(e));
          if (typeName === 'Uint8Array')
            return new PythonCall(new PythonIdentifier('bytes'), [new PythonList(elements)]);
          // For other typed arrays, use bytearray or numpy
          return new PythonCall(new PythonIdentifier('bytearray'), [new PythonList(elements)]);
        }

        // Size-based: new Uint8Array(n) -> JSUint8Array(n) (masks stores to
        // 8 bits like a real Uint8Array does - see the JSUint8Array
        // HELPER_STUBS entry) or bytearray(n) for other typed widths.
        const args = node.arguments.map(arg => this.transformExpression(arg));
        if (typeName === 'Uint8Array' || typeName === 'Int8Array')
          return new PythonCall(new PythonIdentifier('JSUint8Array'), args);
        return new PythonCall(new PythonIdentifier('bytearray'), args);
      }

      // Handle Array constructor
      if (typeName === 'Array') {
        if (node.arguments.length === 1) {
          // new Array(n) -> JSArray([0] * n)
          // list.__mul__ on a JSArray subclass returns a plain list (CPython
          // doesn't preserve subclass identity through repeat), so wrap the
          // whole expression to keep JS-style auto-growth semantics.
          const size = this.transformExpression(node.arguments[0]);
          const sizedList = new PythonBinaryExpression(new PythonList([PythonLiteral.Int(0)]), '*', size);
          return new PythonCall(new PythonIdentifier('JSArray'), [sizedList]);
        }
        // new Array() -> []
        return new PythonList([]);
      }

      // Known helper classes from AlgorithmFramework
      const HELPER_CLASSES = new Set([
        'KeySize', 'LinkItem', 'Vulnerability', 'TestCase', 'AuthResult'
      ]);

      // Track helper class usage for stub generation
      if (typeName && HELPER_CLASSES.has(typeName))
        this.helperClasses.add(typeName);

      // new ClassName(args) -> ClassName(args)
      const className = typeName ? toPascalCase(typeName) : this.transformExpression(node.callee);
      const args = node.arguments.map(arg => this.transformExpression(arg));

      const callee = typeof className === 'string'
        ? new PythonIdentifier(className)
        : className;

      return new PythonCall(callee, args);
    }

    transformArrayExpression(node) {
      const elements = node.elements.map(el => this.transformExpression(el));
      return new PythonList(elements);
    }

    transformObjectExpression(node, selfName) {
      const items = [];
      const spreads = [];

      // Helper to check for UpdateExpression
      const isUpdateExpr = (n) => n && (n.type === 'UpdateExpression' ||
        (n.type === 'UnaryExpression' && (n.operator === '++' || n.operator === '--')));

      // See the matching comment in the 'ObjectLiteral' case of
      // transformExpression: accumulated separately from
      // this.pendingPreStatements because transforming a *later* property
      // can reset that shared buffer, discarding an *earlier* property's
      // hoisted function def before it's ever flushed.
      const hoistedFnDefs = [];

      // Pre-scan get/set accessor properties and group both halves of a pair
      // by their snake_cased key. A legacy `const X = { set key(v){...}, get
      // key(){...} }` object literal (deal.js/lucifer.js/mars.js/pike.js/
      // xchacha20.js CreateInstance patterns) produces two separate Property
      // nodes with the *same* key and kind 'get'/'set' - processed as plain
      // items below, the second would silently clobber the first in the dict
      // literal (Python dict literals keep only the last of a duplicate key),
      // losing whichever accessor came first. Instead collapse each pair into
      // a single `_JSAccessor(fget=..., fset=...)` dict entry (see the
      // JSObject helper stub's __getattribute__/__setattr__ override) so
      // `instance.key = bytes` actually invokes the setter instead of
      // overwriting a plain attribute.
      const accessorGroups = new Map();
      for (const prop of node.properties) {
        if (prop.type === 'SpreadElement' || (prop.kind !== 'get' && prop.kind !== 'set')) continue;
        if (prop.key?.type !== 'Identifier') continue; // computed accessor key: fall through to generic handling
        const snakeKey = toSnakeCaseProperty(prop.key.name);
        let group = accessorGroups.get(snakeKey);
        if (!group) { group = {}; accessorGroups.set(snakeKey, group); }
        if (prop.kind === 'get') group.getProp = prop; else group.setProp = prop;
      }
      const accessorEmitted = new Set();

      for (const prop of node.properties) {
        if (prop.type === 'SpreadElement') {
          // Handle spread elements like {...obj}
          spreads.push(this.transformExpression(prop.argument));
        } else if ((prop.kind === 'get' || prop.kind === 'set') && prop.key?.type === 'Identifier') {
          const snakeKey = toSnakeCaseProperty(prop.key.name);
          if (accessorEmitted.has(snakeKey)) continue; // other half of the pair already emitted this entry
          accessorEmitted.add(snakeKey);
          const group = accessorGroups.get(snakeKey);
          const buildAccessorFn = (accessorProp, kindLabel) => {
            if (!accessorProp) return new PythonIdentifier('None');
            this._objFnCounter = (this._objFnCounter || 0) + 1;
            const helperName = '_objfn_' + toSnakeCase(snakeKey) + '_' + kindLabel + '_' + this._objFnCounter;
            if (selfName) this._objSelfNameStack.push(selfName);
            let funcDef;
            try {
              funcDef = this.transformArrowToFunction(helperName, accessorProp.value);
            } finally {
              if (selfName) this._objSelfNameStack.pop();
            }
            hoistedFnDefs.push(funcDef);
            return new PythonIdentifier(helperName);
          };
          const fget = buildAccessorFn(group.getProp, 'get');
          const fset = buildAccessorFn(group.setProp, 'set');
          const key = PythonLiteral.Str(snakeKey);
          const value = new PythonCall(new PythonIdentifier('_JSAccessor'), [], [
            { name: 'fget', value: fget },
            { name: 'fset', value: fset }
          ]);
          items.push({ key, value });
        } else {
          // Convert key to snake_case for consistency with property access
          // (toSnakeCaseProperty, not toSnakeCase - see its doc comment: object
          // keys/attributes never shadow builtins the way local variables do,
          // and several test-vector fields like "input"/"type" must stay
          // unescaped for the fixed-contract test harnesses to find them).
          // A numeric-literal key (e.g. ecc/bicycle-code.js's `{ 0b00: [...],
          // 0b01: [...], ... }` lookup table, keyed by 2-bit logical
          // state) - JS's ToPropertyKey coerces ANY numeric object-literal
          // key to the decimal string of its VALUE ("0", not "0b00"),
          // matching what JSObject._k() converts an int lookup key to at
          // read time (see its doc comment). Falling through to the
          // generic `transformExpression(prop.key)` below instead emits a
          // Python string literal built from the literal's ORIGINAL source
          // spelling (`"0b00"`) - a dict key nothing ever looks up (every
          // real access uses an int, normalized to "0" by JSObject._k()),
          // so the lookup always misses.
          const isNumericKeyLiteral = prop.key?.type === 'Literal' &&
            (typeof prop.key.value === 'number' || typeof prop.key.value === 'bigint');
          // Inside a JSON.stringify(...) argument (see
          // `_preserveJsonObjectKeys`'s setter at the JSON.stringify call
          // site), keep the RAW JS property spelling instead of
          // snake_casing it - the resulting JSON text is externally-visible
          // byte data (compared byte-for-byte against a hardcoded test
          // vector recorded from the real JS's own camelCase output, e.g.
          // compression/deflate-simple.js's `_packCompressedData` encoding
          // `huffmanResult`/`originalLength`), not a Python identifier, so
          // "matches Python style" is the wrong goal here - only "matches
          // what JS actually wrote" is.
          const key = prop.key?.type === 'Identifier'
            ? PythonLiteral.Str(this._preserveJsonObjectKeys ? prop.key.name : toSnakeCaseProperty(prop.key.name))
            : isNumericKeyLiteral
              ? PythonLiteral.Str(String(prop.key.value))
              : this.transformExpression(prop.key);

          // Handle UpdateExpression in property value (e.g., { code: arr[i]++ })
          // Python doesn't support ++/-- as expressions in dict values
          let value;
          if ((prop.value?.type === 'FunctionExpression' || prop.value?.type === 'ArrowFunctionExpression' || prop.value?.type === 'ArrowFunction') &&
              prop.value.body && prop.value.body.type === 'BlockStatement') {
            // Legacy `const X = { method: function(a, b) { ...; return c; } }`
            // namespace-object pattern (common across this codebase in place
            // of a real class - see e.g. NumberTheory in rabin.js). Routing
            // this through the generic FunctionExpression path
            // (transformLambdaExpression) would silently keep only the
            // *first* statement of the body and drop the rest - Python
            // lambdas are single-expression only - degrading every
            // multi-statement/loop-bearing method into `lambda *a: None`
            // (every call through the dict then returns None). Hoist a real
            // named function next to the dict literal instead, exactly like
            // transformVariableDeclaration already does for a bare
            // `const foo = function() {...}`, and reference it by name.
            const propKeyName = prop.key?.type === 'Identifier' ? prop.key.name :
              (prop.key?.value !== undefined ? String(prop.key.value) : 'fn');
            this._objFnCounter = (this._objFnCounter || 0) + 1;
            const helperName = '_objfn_' + toSnakeCase(propKeyName) + '_' + this._objFnCounter;
            // Only while transforming *this function's own body* does `this`
            // inside it mean "the object it's a property of" - a plain
            // (non-function) sibling property value still executes in the
            // enclosing method's `this` (object literals don't create a new
            // `this` binding in JS), so the substitution must not leak
            // outside this one hoisted-function's body.
            if (selfName) this._objSelfNameStack.push(selfName);
            let funcDef;
            try {
              funcDef = this.transformArrowToFunction(helperName, prop.value);
            } finally {
              if (selfName) this._objSelfNameStack.pop();
            }
            hoistedFnDefs.push(funcDef);
            value = new PythonIdentifier(helperName);
          } else if (isUpdateExpr(prop.value)) {
            const target = this.transformExpression(prop.value.argument);
            const one = PythonLiteral.Int(1);
            const op = prop.value.operator === '++' ? '+=' : '-=';
            const updateStmt = new PythonAssignment(target, one);
            updateStmt.operator = op;
            updateStmt.isAugmented = true;

            if (prop.value.prefix) {
              // Prefix ++x: increment first, then use new value
              if (!this.pendingPreStatements) this.pendingPreStatements = [];
              this.pendingPreStatements.push(updateStmt);
              value = this.transformExpression(prop.value.argument);
            } else {
              // Postfix x++: use current value, then increment
              this.pendingPostStatements.push(updateStmt);
              value = this.transformExpression(prop.value.argument);
            }
          } else if (prop.value?.type === 'AssignmentExpression') {
            // Handle assignment expressions in property value
            const assignment = this.transformAssignmentExpression(prop.value);
            if (!this.pendingPreStatements) this.pendingPreStatements = [];
            this.pendingPreStatements.push(assignment);
            value = this.transformAssignmentExpressionForExpression(prop.value, true);
          } else {
            value = this.transformExpression(prop.value);
          }
          items.push({ key, value });
        }
      }

      if (hoistedFnDefs.length > 0) {
        if (!this.pendingPreStatements) this.pendingPreStatements = [];
        this.pendingPreStatements.push(...hoistedFnDefs);
      }

      // If there are spreads, we need to merge dictionaries
      if (spreads.length > 0) {
        // Build: {**spread1, **spread2, key1: val1, ...}
        const dict = new PythonDict(items);
        dict.spreads = spreads;
        return dict;
      }

      return new PythonDict(items);
    }

    transformConditionalExpression(node) {
      // Apply the same bare-member-access-in-a-truthiness-test safety net
      // used for `&&`/`||` operands (_safeLogicalMemberOperand) to the
      // ternary's test too - `X.optionalMethod ? X.optionalMethod() : Y`
      // (feature-detecting an optional method before calling it, e.g.
      // dstu7624mac.js/gost28147mac.js's `AlgorithmFramework.GetRegistry ?
      // AlgorithmFramework.GetRegistry() : null`) is the same "missing
      // property reads falsy instead of raising" JS idiom as a bare `X &&
      // X.Y`, just spelled as `X.Y ? ... : ...` instead - without this, a
      // plain `AlgorithmFramework.get_registry` attribute read on a class
      // that (correctly) never defines that optional method raises
      // AttributeError immediately instead of taking the ternary's falsy
      // branch, typically surfacing as a much-later, harder-to-diagnose
      // failure once the exception unwinds through an unrelated caller's
      // broad `except Exception: pass`.
      const condition = this._safeLogicalMemberOperand(node.test, this.transformExpression(node.test));
      const trueExpr = this.transformExpression(node.consequent);
      const falseExpr = this.transformExpression(node.alternate);

      return new PythonConditional(trueExpr, condition, falseExpr);
    }

    transformLambdaExpression(node) {
      const params = node.params.map(p => this.transformParameter(p));
      const bodyNode = node.body;

      let body;
      if (bodyNode.type === 'BlockStatement') {
        // BlockStatement body - extract the first statement's return value or expression
        const firstStmt = bodyNode.body[0];
        if (firstStmt) {
          body = this.transformLambdaBody(firstStmt.argument || firstStmt.expression);
        }
      } else {
        body = this.transformLambdaBody(bodyNode);
      }

      // If body transformation returned null or undefined, use None
      if (!body) {
        return new PythonLambda(params, new PythonIdentifier('None'));
      }

      return new PythonLambda(params, body);
    }

    /**
     * Transform lambda body expression, handling cases that can't be Python lambda bodies.
     * Python lambdas can only contain expressions, not statements or assignments.
     * For assignments like `x = expr`, we return just `expr`.
     * For compound assignments like `x += expr`, we return the computed value.
     */
    transformLambdaBody(bodyNode) {
      if (!bodyNode) return null;

      // Handle AssignmentExpression - Python lambdas can't have assignments
      // Convert `x = expr` to just `expr` (return the value being assigned)
      // Convert `x += y` to `x + y` (return the computed value)
      if (bodyNode.type === 'AssignmentExpression') {
        return this.transformAssignmentExpressionForExpression(bodyNode);
      }

      // Handle UpdateExpression - Python lambdas can't have i++ or ++i
      if (bodyNode.type === 'UpdateExpression') {
        return this.transformUpdateExpressionForExpression(bodyNode);
      }

      // For other expressions, use normal transformation
      return this.transformExpression(bodyNode);
    }

    /**
     * Transform an arrow/function expression with a block body into a named function definition
     * Used when arrow functions have multiple statements (can't be Python lambdas)
     */
    transformArrowToFunction(name, node) {
      const params = node.params.map(p => this.transformParameter(p));

      const func = new PythonFunction(name, params, null);
      this._ensureVarArgsTolerance(func);
      // transformReturnStatement() treats "no currentMethod/currentClass" as
      // module-top-level UMD-export boilerplate and silently drops the
      // `return` (see its guard) - without marking this hoisted function as
      // "inside a function" while its body is transformed, a body that is
      // (or reduces to) just `return x;` loses the return entirely and
      // becomes an empty `pass` (see the identical fix/comment for hoisted
      // callback helpers a few hundred lines below, transformCallbackExpr).
      const prevMethod = this.currentMethod;
      this.currentMethod = func;
      this._enclosingLocalsStack.push(new Set());
      func.body = this.transformBlockOrStatement(node.body);
      this._addNonlocalDeclarationsIfNeeded(func);
      this._enclosingLocalsStack.pop();
      this.currentMethod = prevMethod;

      this._addGlobalDeclarationsIfNeeded(func);
      return func;
    }

    transformTemplateLiteral(node) {
      // Convert template literal to Python f-string AST node
      const parts = [];
      const expressions = [];

      for (let i = 0; i < node.quasis.length; ++i) {
        parts.push(node.quasis[i].value.raw || '');
        if (i < node.expressions.length)
          expressions.push(this.transformExpression(node.expressions[i]));
      }

      return new PythonFString(parts, expressions);
    }

    // ========================[ IL AST NODE TRANSFORMERS ]========================

    /**
     * Transform ParentConstructorCall to super().__init__(...)
     */
    transformParentConstructorCall(node) {
      const args = (node.arguments || []).map(arg => this.transformExpression(arg));
      return new PythonCall(
        new PythonMemberAccess(new PythonCall(new PythonIdentifier('super'), []), '__init__'),
        args
      );
    }

    /**
     * Transform ParentMethodCall to super().method_name(...)
     */
    transformParentMethodCall(node) {
      const args = (node.arguments || []).map(arg => this.transformExpression(arg));
      const methodName = toSnakeCase(node.method);
      return new PythonCall(
        new PythonMemberAccess(new PythonCall(new PythonIdentifier('super'), []), methodName),
        args
      );
    }

    /**
     * Transform ThisMethodCall to self.method_name(...)
     * Handles postfix increments in arguments (n++ -> use n, add n += 1 after)
     */
    transformThisMethodCall(node) {
      // Transform arguments, handling UpdateExpression and UnaryExpression (++/--) specially
      // Python doesn't support i++, ++i as expressions in function arguments
      const args = (node.arguments || []).map(arg => {
        const isUpdate = arg.type === 'UpdateExpression' ||
                        (arg.type === 'UnaryExpression' && (arg.operator === '++' || arg.operator === '--'));
        if (isUpdate) {
          // For postfix increment/decrement, we need to:
          // 1. Use the current value in the function call
          // 2. Add increment/decrement as post-statement to execute after the call
          if (!arg.prefix) {
            // Postfix: n++ or n-- -> use n, then add n += 1 or n -= 1 after
            const target = this.transformExpression(arg.argument);
            const one = PythonLiteral.Int(1);
            const op = arg.operator === '++' ? '+=' : '-=';
            const postIncrement = new PythonAssignment(target, one);
            postIncrement.operator = op;
            postIncrement.isAugmented = true;
            this.pendingPostStatements.push(postIncrement);
            // Return just the variable (current value before increment)
            return this.transformExpression(arg.argument);
          }
          // Prefix: ++n or --n -> use n + 1 or n - 1
          return this.transformUpdateExpressionForExpression(arg);
        }
        if (arg.type === 'AssignmentExpression') {
          // For assignment expressions in function arguments:
          // foo(x = value) -> x = value; foo(x)
          // Extract the assignment as a pre-statement and use the assigned value in the call
          const assignment = this.transformAssignmentExpression(arg);
          if (!this.pendingPreStatements) this.pendingPreStatements = [];
          this.pendingPreStatements.push(assignment);
          // Return the value that was assigned (the right side of the assignment)
          return this.transformAssignmentExpressionForExpression(arg, true);
        }
        return this.transformExpression(arg);
      });
      let methodName = toSnakeCase(node.method);
      // Disambiguate methods that only collide after case-folding (see the
      // currentMethodNameOverrides comment in transformClassDeclaration -
      // e.g. shacal-2.js's `_Sigma0`/`_sigma0`). This IL node type is the
      // normalized form of a plain `this.method(...)` call (the shared
      // type-aware-transpiler.js parser folds it out of the generic
      // MemberExpression+CallExpression shape before PythonTransformer ever
      // sees it), so the override has to be applied here too, not just in
      // transformCallExpression's generic fallback.
      if (this.currentMethodNameOverrides && this.currentMethodNameOverrides.has(node.method)) {
        methodName = this.currentMethodNameOverrides.get(node.method);
      }
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier(this._currentSelfName()), methodName),
        args
      );
    }

    /**
     * Transform ThisPropertyAccess to self.property_name
     */
    transformThisPropertyAccess(node) {
      let propName = toSnakeCase(node.property);

      // Check for backing field access inside a getter/setter (see the
      // matching comment in transformMemberExpression / the
      // currentPropertyNameRaw setup in transformMethodDefinition for why
      // the raw-name comparison guards against misfiring on a deliberate
      // same-name recursive self-reassignment).
      if (this.currentPropertyName && propName === this.currentPropertyName &&
          node.property !== this.currentPropertyNameRaw) {
        propName = '_' + propName + '_backing';
      }

      // Check for a field/method collision that is an ARTIFACT OF
      // SNAKE-CASE FOLDING (see the matching, fuller comment in
      // transformMemberExpression's dot-access branch) - only rename when
      // the raw JS property name differs from every raw method name that
      // folds to the same snake_case bucket. A read of the exact same raw
      // JS identifier as an existing method (e.g. haval.js's bare
      // `this.fp3_1` reference, collected into an array and dispatched via
      // `.call(this, ...)`) must resolve to the real bound method instead.
      if (this.currentClassMethodNames) {
        const rawNames = this.currentClassMethodNames.get(propName);
        if (rawNames && !rawNames.has(node.property)) {
          propName = '_' + propName + '_value';
        } else if (this.currentMethodNameOverrides && this.currentMethodNameOverrides.has(node.property)) {
          // See the currentMethodNameOverrides comment in transformClassDeclaration.
          propName = this.currentMethodNameOverrides.get(node.property);
        }
      }

      return new PythonMemberAccess(new PythonIdentifier(this._currentSelfName()), propName);
    }

    /**
     * Transform RotateLeft/RotateRight to bitwise rotation
     * Python: ((value << amount) | (value >> (bits - amount))) & mask
     */
    transformRotation(node) {
      const rawValue = this.transformExpression(node.value);
      const rawAmount = this.transformExpression(node.amount);
      const bits = node.bits || 32;
      const isLeft = node.type === 'RotateLeft';

      // Calculate mask for the bit width
      // Note: (1 << 32) overflows in JS, so special-case 32-bit
      const mask = bits === 64 ? 0xFFFFFFFFFFFFFFFF : (bits === 32 ? 0xFFFFFFFF : (1 << bits) - 1);
      const maskLit = bits === 64 ? new PythonIdentifier('0xFFFFFFFFFFFFFFFF') : PythonLiteral.Hex(mask >>> 0);
      const bitsLit = PythonLiteral.Int(bits);

      // `value` can be a negative Python int (e.g. the signed result of a
      // prior Math.imul/ToInt 32-bit conversion, as in xoshiro128**'s
      // `rotl(s[1] * 5, 7)`). JS's real OpCodes.RotL32/RotR32 always mask the
      // *value* to unsigned first (`value &= 0xFFFFFFFF` in OpCodes.js)
      // before shifting - masking only the final OR'd result (the previous
      // behavior here) is wrong for negative `value`, because Python's `>>`
      // on a negative int sign-extends (arithmetic shift) instead of doing
      // the logical shift a bit rotation requires, producing runs of 1-bits
      // that survive the trailing mask. Mask the operand up front instead.
      const value = new PythonBinaryExpression(rawValue, '&', maskLit);

      // Real OpCodes.RotL32/RotR32 always mask the rotate amount to the bit
      // width first (`positions &= 31` in OpCodes.js) before using it - a
      // rotate-by-40 on a 32-bit value is a well-defined rotate-by-8, not an
      // error. Skip the mask for small literal amounts already known to be
      // in range (keeps common cases like RotL32(x, 7) readable); a computed
      // amount (loop-driven key schedules etc.) always gets masked, since an
      // unmasked amount can otherwise make `bits - amount` negative and
      // crash Python's `>>`/`<<` with "negative shift count" (JS shifts
      // never error - out-of-range counts silently wrap instead).
      const amountLiteralValue = node.amount && node.amount.type === 'Literal' ? node.amount.value : undefined;
      const amount = (typeof amountLiteralValue === 'number' && Number.isInteger(amountLiteralValue) &&
          amountLiteralValue >= 0 && amountLiteralValue < bits)
        ? rawAmount
        : new PythonBinaryExpression(rawAmount, '&', PythonLiteral.Int(bits - 1));

      if (isLeft) {
        // ((value << amount) | (value >> (bits - amount))) & mask
        const leftShift = new PythonBinaryExpression(value, '<<', amount);
        const rightAmount = new PythonBinaryExpression(bitsLit, '-', amount);
        const rightShift = new PythonBinaryExpression(value, '>>', rightAmount);
        const combined = new PythonBinaryExpression(leftShift, '|', rightShift);
        return new PythonBinaryExpression(combined, '&', maskLit);
      } else {
        // ((value >> amount) | (value << (bits - amount))) & mask
        const rightShift = new PythonBinaryExpression(value, '>>', amount);
        const leftAmount = new PythonBinaryExpression(bitsLit, '-', amount);
        const leftShift = new PythonBinaryExpression(value, '<<', leftAmount);
        const combined = new PythonBinaryExpression(rightShift, '|', leftShift);
        return new PythonBinaryExpression(combined, '&', maskLit);
      }
    }

    /**
     * Transform PackBytes to int.from_bytes([b0, b1, ...], byteorder)
     * IL AST: { type: 'PackBytes', arguments: [b0, b1, b2, b3], bits: 32, endian: 'big'|'little' }
     *
     * This packs multiple bytes INTO a single integer value (opposite of UnpackBytes)
     * Python: int.from_bytes([b0, b1, b2, b3], 'big') or 'little'
     */
    transformPackBytes(node) {
      // IL AST uses node.arguments, fallback to node.bytes for compatibility
      const bytes = (node.arguments || node.bytes || []).map(b => this.transformExpression(b));
      const byteOrder = node.endian === 'big' ? 'big' : 'little';

      // Use int.from_bytes which is cleaner and doesn't require struct import
      // int.from_bytes([b0, b1, b2, b3], 'big')
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('int'), 'from_bytes'),
        [new PythonList(bytes), PythonLiteral.Str(byteOrder)]
      );
    }

    /**
     * Transform UnpackBytes to value.to_bytes(length, byteorder)
     * IL AST: { type: 'UnpackBytes', arguments: [intValue], bits: 32, endian: 'big'|'little' }
     *
     * This unpacks a single integer INTO multiple bytes (opposite of PackBytes)
     * Python: value.to_bytes(4, 'big') returns a bytes object
     * To get a list: list(value.to_bytes(4, 'big'))
     *
     * IMPORTANT: Python's to_bytes() requires unsigned integers within the byte range.
     * JavaScript integers from bitwise operations are always in 32-bit range, but Python
     * integers are unbounded. We must mask the value to ensure it fits in the byte count.
     */
    transformUnpackBytes(node) {
      // IL AST uses node.arguments[0], fallback to node.value for compatibility
      const value = this.transformExpression(node.arguments?.[0] || node.value);
      const byteOrder = node.endian === 'big' ? 'big' : 'little';
      const bits = node.bits || 32;
      const byteCount = Math.floor(bits / 8);

      // Calculate mask based on byte count to ensure value fits
      // For 4 bytes: 0xFFFFFFFF, for 8 bytes: 0xFFFFFFFFFFFFFFFF, etc.
      const mask = (1n << BigInt(bits)) - 1n;
      const maskValue = Number(mask);

      // Mask the value to ensure it's unsigned and fits in the byte count
      // (value & mask).to_bytes(byteCount, byteOrder)
      const maskedValue = new PythonBinaryExpression(value, '&', PythonLiteral.Int(maskValue));

      // Wrap in list() to get a list of bytes that can be concatenated
      return new PythonCall(
        new PythonIdentifier('list'),
        [new PythonCall(
          new PythonMemberAccess(maskedValue, 'to_bytes'),
          [PythonLiteral.Int(byteCount), PythonLiteral.Str(byteOrder)]
        )]
      );
    }

    /**
     * Transform ArrayLength (`.length`, on whatever the type-aware IL pass
     * saw the object as - it turns *every* `.length` access into this node,
     * including reads on plain object literals like `{length, distance}`
     * returned from a match-finder, since JS makes no syntactic distinction
     * between array.length and object.length). Route through the _js_len
     * helper rather than emitting bare len(...): for real
     * lists/strings/dicts it behaves identically, but for a JSObject (or any
     * other custom object exposing its own `.length` attribute) it reads
     * that attribute instead of raising "object of type 'JSObject' has no
     * len()".
     */
    transformArrayLength(node) {
      const array = this.transformExpression(node.array);
      this.frameworkFunctions.add('_js_len');
      return new PythonCall(new PythonIdentifier('_js_len'), [array]);
    }

    /**
     * Transform ArrayAppend to array.append(value) or array.extend(value) for spread
     */
    transformArrayAppend(node) {
      const array = this.transformExpression(node.array);

      // Handle multiple values (push with multiple arguments)
      const values = node.values || (node.value ? [node.value] : []);

      // Check if any values are SpreadElements
      const hasSpread = values.some(v => v?.type === 'SpreadElement');

      if (hasSpread) {
        // Check if all values are SpreadElements
        const allSpread = values.every(v => v?.type === 'SpreadElement');
        if (allSpread) {
          if (values.length === 1) {
            // arr.push(...data) -> arr.extend(data)
            const spreadValue = this.transformExpression(values[0].argument);
            return new PythonCall(
              new PythonMemberAccess(array, 'extend'),
              [spreadValue]
            );
          }
          // arr.push(...a, ...b, ...c) -> arr.extend(a + b + c)
          const spreadArgs = values.map(v => this.transformExpression(v.argument));
          let concatenated = spreadArgs[0];
          for (let i = 1; i < spreadArgs.length; ++i)
            concatenated = new PythonBinaryExpression(concatenated, '+', spreadArgs[i]);
          return new PythonCall(
            new PythonMemberAccess(array, 'extend'),
            [concatenated]
          );
        }
        // Mixed spread and non-spread: arr.push(x, ...y, z)
        const parts = values.map(v => {
          if (v?.type === 'SpreadElement')
            return this.transformExpression(v.argument);
          return new PythonList([this.transformExpression(v)]);
        });
        let concatenated = parts[0];
        for (let i = 1; i < parts.length; ++i)
          concatenated = new PythonBinaryExpression(concatenated, '+', parts[i]);
        return new PythonCall(
          new PythonMemberAccess(array, 'extend'),
          [concatenated]
        );
      }

      // No spread. A single value uses .append(value); multiple values
      // (e.g. `arr.push(a, b, c)`, a common byte-packing idiom) must use
      // .extend([a, b, c]) - Python's list.append() takes exactly one
      // argument, so passing all of them to append() either throws or
      // (worse) silently drops every value but the first if only one is
      // forwarded.
      if (values.length <= 1) {
        const value = values.length === 1 ? this.transformExpression(values[0]) : this.transformExpression(node.value);
        return new PythonCall(
          new PythonMemberAccess(array, 'append'),
          [value]
        );
      }
      const items = values.map(v => this.transformExpression(v));
      return new PythonCall(
        new PythonMemberAccess(array, 'extend'),
        [new PythonList(items)]
      );
    }

    /**
     * Transform ArraySlice to array[start:end]
     */
    transformArraySlice(node) {
      const array = this.transformExpression(node.array);
      const start = node.start ? this.transformExpression(node.start) : null;
      const end = node.end ? this.transformExpression(node.end) : null;
      return new PythonSubscript(array, new PythonSlice(start, end));
    }

    /**
     * Transform ArrayFill to [value] * size or similar
     */
    transformArrayFill(node) {
      const value = this.transformExpression(node.value);

      // Check if the array is a NewExpression for Array(n) - we can use n directly
      // This handles the common pattern: new Array(16).fill(0) -> [0] * 16
      // NOTE: every branch below wraps its `[value] * size` multiplication in
      // an explicit JSArray(...) call - see the matching comment in
      // transformArrayCreation() for why: PythonList emits as `JSArray([...])`
      // to get JS-style auto-growing __setitem__, but list.__mul__ on a
      // JSArray subclass returns a plain `list` (CPython doesn't preserve
      // subclass identity through repeat), so `JSArray([0]) * size` used
      // directly - e.g. as `this.buf = new Array(n).fill(0)` - silently
      // downgrades back to a plain list that raises IndexError instead of
      // extending on an out-of-bounds assignment (seen in cfbmac.js's
      // `new Array(this.blockSize).fill(0)` key-schedule buffer).
      if (node.array?.type === 'NewExpression' &&
          (node.array.callee?.name === 'Array' || node.array.callee?.type === 'Identifier' && node.array.callee.name === 'Array') &&
          node.array.arguments?.length === 1) {
        const size = this.transformExpression(node.array.arguments[0]);
        return new PythonCall(new PythonIdentifier('JSArray'), [new PythonBinaryExpression(new PythonList([value]), '*', size)]);
      }

      // Check if the array is an ArrayCreation IL node (created from new Array(n))
      if ((node.array?.type === 'ArrayCreate' || node.array?.type === 'ArrayCreation') && node.array.size != null) {
        const size = this.transformExpression(node.array.size);
        return new PythonCall(new PythonIdentifier('JSArray'), [new PythonBinaryExpression(new PythonList([value]), '*', size)]);
      }

      // General case: an already-declared array (not a `new Array(n)`
      // literal being filled at construction time, handled above - those
      // two cases have no prior contents/references to preserve, so a
      // fresh array is fine). JS Array/TypedArray#fill() mutates the
      // receiver IN PLACE (e.g. compression/lz4.js's `hashTable.fill(-1)`,
      // resetting an already-shared/referenced hash table before reuse) -
      // `[value] * len(array)` (used here previously, per this function's
      // own now-outdated comment acknowledging the gap) builds a
      // disconnected new list instead, leaving the original array (and
      // every other reference to it) untouched. _js_fill (see its
      // HELPER_STUBS doc comment) mutates and returns the same reference,
      // matching JS.
      const array = this.transformExpression(node.array);
      const fillArgs = [array, value];
      if (node.start) fillArgs.push(this.transformExpression(node.start));
      if (node.end) fillArgs.push(this.transformExpression(node.end));
      return new PythonCall(new PythonIdentifier('_js_fill'), fillArgs);
    }

    /**
     * Transform ArrayXor to [a ^ b for a, b in zip(arr1, arr2)]
     * Returns a list (not bytes) to match JavaScript array behavior
     */
    transformArrayXor(node) {
      // IL AST uses node.arguments[0,1], fallback to node.left/right for compatibility
      const left = this.transformExpression(node.arguments?.[0] || node.left);
      const right = this.transformExpression(node.arguments?.[1] || node.right);
      // [a ^ b for a, b in zip(left, right)]
      const xorExpr = new PythonBinaryExpression(
        new PythonIdentifier('a'),
        '^',
        new PythonIdentifier('b')
      );
      const zipCall = new PythonCall(new PythonIdentifier('zip'), [left, right]);
      // Return list comprehension directly (not wrapped in bytes())
      return new PythonListComprehension(xorExpr, new PythonTuple([new PythonIdentifier('a'), new PythonIdentifier('b')]), zipCall);
    }

    /**
     * Transform ArrayClear to array.clear()
     */
    transformArrayClear(node) {
      // IL AST uses node.arguments[0], fallback to node.array for compatibility
      const array = this.transformExpression(node.arguments?.[0] || node.array);
      return new PythonCall(new PythonMemberAccess(array, 'clear'), []);
    }

    /**
     * Transform ArrayIndexOf to array.index(value)
     * Note: Python's index() raises ValueError if not found; for -1 behavior,
     * caller should wrap in try/except or use "value in array" check first
     */
    transformArrayIndexOf(node) {
      const array = this.transformExpression(node.array);
      const value = this.transformExpression(node.value);
      // Use list.index(value) - returns index or raises ValueError
      // For JavaScript-like behavior (-1 if not found), use:
      // array.index(value) if value in array else -1
      return new PythonConditional(
        new PythonCall(new PythonMemberAccess(array, 'index'), [value]),
        new PythonBinaryExpression(value, 'in', array),
        PythonLiteral.Int(-1)
      );
    }

    /**
     * Transform ArrayIncludes to (value in array)
     */
    transformArrayIncludes(node) {
      const array = this.transformExpression(node.array);
      const value = this.transformExpression(node.value);
      return new PythonBinaryExpression(value, 'in', array);
    }

    /**
     * Transform ArrayConcat to array.extend(other) for mutation
     * The IL AST uses 'arrays' property (array of arrays to concat)
     */
    transformArrayConcat(node) {
      const array = this.transformExpression(node.array);

      // Handle both 'arrays' (from IL AST) and 'other' (legacy) properties
      const toConcat = node.arrays || (node.other ? [node.other] : []);

      if (toConcat.length === 0) {
        // Nothing to concat, return the array as-is
        return array;
      }

      // Use + operator for concatenation since it returns a new list
      // This is important for expression contexts like: result = arr.concat(other)
      // list.extend() returns None (modifies in-place) which would break assignments
      let result = array;
      for (const arr of toConcat) {
        const other = this.transformExpression(arr);
        // Wrap each operand in list() call to ensure concatenation works with
        // any iterable (bytes, tuples, generators, etc.)
        result = new PythonBinaryExpression(
          result,
          '+',
          new PythonCall(new PythonIdentifier('list'), [other])
        );
      }
      return result;
    }

    /**
     * Transform ArrayJoin to separator.join(str(x) for x in array)
     */
    transformArrayJoin(node) {
      const array = this.transformExpression(node.array);
      const separator = node.separator ? this.transformExpression(node.separator) : PythonLiteral.Str('');
      // JavaScript's join() converts all elements to strings automatically
      // Python requires explicit conversion: separator.join(str(x) for x in array)
      const strCall = new PythonCall(new PythonIdentifier('str'), [new PythonIdentifier('x')]);
      const genExpr = new PythonGeneratorExpression(strCall, 'x', array);
      return new PythonCall(new PythonMemberAccess(separator, 'join'), [genExpr]);
    }

    /**
     * Transform ArrayReverse to list(reversed(array)) for a new reversed copy
     */
    transformArrayReverse(node) {
      const array = this.transformExpression(node.array);
      // Use list(reversed(array)) to get a new reversed list
      // For in-place reversal, caller should use array.reverse()
      return new PythonCall(
        new PythonIdentifier('list'),
        [new PythonCall(new PythonIdentifier('reversed'), [array])]
      );
    }

    /**
     * Transform ArrayPop to array.pop()
     */
    transformArrayPop(node) {
      const array = this.transformExpression(node.array);
      return new PythonCall(new PythonMemberAccess(array, 'pop'), []);
    }

    /**
     * Transform ArrayShift to array.pop(0)
     */
    transformArrayShift(node) {
      const array = this.transformExpression(node.array);
      return new PythonCall(new PythonMemberAccess(array, 'pop'), [PythonLiteral.Int(0)]);
    }

    /**
     * Transform ArrayUnshift to array.insert(0, value)
     */
    transformArrayUnshift(node) {
      const array = this.transformExpression(node.array);
      const value = this.transformExpression(node.value);
      return new PythonCall(new PythonMemberAccess(array, 'insert'), [PythonLiteral.Int(0), value]);
    }

    /**
     * Transform ArrayCreation to [0] * size or []
     */
    transformArrayCreation(node) {
      if (node.size) {
        const size = this.transformExpression(node.size);
        // `new Array(n)` needs JS-style auto-growing __setitem__ just like
        // any other array literal (e.g. feal-nx.js's key-schedule loop
        // `subKeys[4*i] = ...` up to the preallocated length) - PythonList
        // emits as `JSArray([...])` (see PythonEmitter.emitList) to get
        // that, but only the PythonList *node itself* gets that wrapping.
        // list.__mul__ on a JSArray subclass returns a plain `list` (CPython
        // doesn't preserve subclass identity through repeat), so applying
        // '*' OUTSIDE this call - `JSArray([0]) * size` - silently downgrades
        // right back to a plain list that raises IndexError instead of
        // extending on an out-of-bounds assignment. Wrap the whole
        // multiplication in an explicit JSArray(...) call so the '*' runs
        // first and its plain-list result gets re-wrapped: `JSArray([0] *
        // size)`.
        return new PythonCall(
          new PythonIdentifier('JSArray'),
          [new PythonBinaryExpression(
            new PythonList([PythonLiteral.Int(0)]),
            '*',
            size
          )]
        );
      }
      return new PythonList([]);
    }

    /**
     * Transform TypedArrayCreation to bytearray(size) or similar
     * Handles: new TypedArray(size), new TypedArray(existingArray)
     */
    transformTypedArrayCreation(node) {
      const arrayType = node.arrayType || 'Uint8Array';

      // Check if this is a copy from an existing array vs size-based creation
      // When buffer is set and is an identifier, we need to distinguish between:
      // - new Uint32Array(IV) where IV is an array -> copy operation
      // - new Uint32Array(count) where count is a number -> size-based
      const isArrayCopy = node.buffer && (
        node.buffer.type === 'Identifier' ||
        node.buffer.type === 'MemberExpression'
      ) && this._isLikelyArrayArgument(node.buffer);

      // For array copy operations, we need to copy the array, not multiply
      if (isArrayCopy) {
        // `new Uint8Array(X.buffer)` / the 3-arg view form `new
        // Uint8Array(X.buffer, X.byteOffset, X.byteLength)` (e.g.
        // argon2.js's `new Uint8Array(A.buffer, A.byteOffset,
        // A.byteLength)`, reinterpreting a Uint32Array's bytes as a
        // Uint8Array view) - the IL TypedArrayCreation node only ever
        // carries the first constructor argument (X.buffer), the offset/
        // length are lost before this transformer ever sees them. `X.buffer`
        // itself, transformed as an ordinary member access, becomes a plain
        // `.buffer` attribute read on X - AttributeError at runtime, since
        // nothing in this runtime models a typed array as a separate
        // buffer-plus-view pair (a byte list already *is* its own backing
        // buffer here). Unwrap `X.buffer` to plain `X` so the copy/view is
        // at least built from X's own bytes (losing the offset/length
        // slicing, but no longer crashing outright).
        const isBufferPeel = node.buffer.type === 'MemberExpression' &&
          !node.buffer.computed &&
          (node.buffer.property?.name === 'buffer' || node.buffer.property?.value === 'buffer');
        const bufferNode = isBufferPeel ? node.buffer.object : node.buffer;
        const buffer = this.transformExpression(bufferNode);
        if (arrayType === 'Uint8Array' || arrayType === 'Int8Array') {
          // `new Uint8Array(X.buffer)` where X holds 32-bit words (a real
          // `new Uint32Array(...)`) needs its buffer decomposed 4-little-
          // endian-bytes-per-word rather than treated as already being a
          // byte sequence - but whether X holds words is only known
          // reliably at RUNTIME here: X may be a function *parameter*
          // (e.g. argon2.js's `function Hp(A, dkLen) { const A8 = new
          // Uint8Array(A.buffer, ...) }`), where no static declaration
          // ties A to a `new Uint32Array(...)` in this scope for the
          // uint32ArrayVarNames tracking (see transformVariableDeclaration)
          // to ever see. _typed_array_bytes (see its HELPER_STUBS entry)
          // defers the choice to actual execution: every `new
          // Uint32Array(...)`/`new Int32Array(...)` creation site below
          // tags its result with the JSUint32Array marker subclass
          // specifically so this dispatch can recognize it regardless of
          // how many function calls removed from the original declaration.
          if (isBufferPeel)
            return new PythonCall(new PythonIdentifier('_typed_array_bytes'), [buffer]);
          // JSUint8Array (see the HELPER_STUBS entry) - a bytearray subclass
          // that masks every store to 8 bits, matching Uint8Array's real
          // ToUint8 store coercion (see that stub's doc comment).
          return new PythonCall(new PythonIdentifier('JSUint8Array'), [buffer]);
        }
        // For other typed arrays, dispatch through _typed_array_view (see
        // its HELPER_STUBS entry) rather than always copying element-by-
        // element: only when `buffer` turns out at RUNTIME to be a real
        // `new ArrayBuffer(...)` (tagged JSArrayBuffer) does this need to
        // become a LIVE width/format-aware view sharing that same buffer
        // (e.g. random/dsfmt.js's `new Uint32Array(buffer)` / `new
        // Float64Array(buffer)` over the same `new ArrayBuffer(8)` - both
        // must alias the same 8 bytes) - every other source (a regular
        // array, or another already-word-shaped TypedArray passed directly)
        // still copies element-by-element exactly as before, matching JS's
        // real TypedArray-from-array-like constructor behavior.
        const TYPED_ARRAY_VIEW_PARAMS = {
          'Uint16Array': [2, null], 'Int16Array': [2, null],
          'Uint32Array': [4, null], 'Int32Array': [4, null],
          'Float32Array': [4, 'f'], 'Float64Array': [8, 'd'],
          'BigUint64Array': [8, null], 'BigInt64Array': [8, null],
        };
        const viewParams = TYPED_ARRAY_VIEW_PARAMS[arrayType];
        if (viewParams) {
          const [width, fmt] = viewParams;
          const args = [buffer, PythonLiteral.Int(width)];
          if (fmt) args.push(PythonLiteral.Str(fmt));
          return new PythonCall(new PythonIdentifier('_typed_array_view'), args);
        }
        return new PythonCall(new PythonIdentifier('list'), [buffer]);
      }

      // Size-based creation: new TypedArray(size)
      const size = node.size ? this.transformExpression(node.size) : null;

      if (arrayType === 'Uint8Array' || arrayType === 'Int8Array') {
        if (size)
          return new PythonCall(new PythonIdentifier('JSUint8Array'), [size]);
        return new PythonCall(new PythonIdentifier('JSUint8Array'), []);
      }
      // For other typed arrays, use list multiplication for size-based creation
      const sizedList = size
        ? new PythonBinaryExpression(new PythonList([PythonLiteral.Int(0)]), '*', size)
        : new PythonList([]);
      // Same JSUint32Array tagging as the copy-path above, for `new
      // Uint32Array(n)`/`new Int32Array(n)` size-based creation.
      if (arrayType === 'Uint32Array' || arrayType === 'Int32Array')
        return new PythonCall(new PythonIdentifier('JSUint32Array'), [sizedList]);
      return sizedList;
    }

    /**
     * Deep clone an AST node, substituting any Identifier with the given name
     * @param {Object} node - AST node to clone
     * @param {string} fromName - Identifier name to replace
     * @param {string} toName - New identifier name
     * @returns {Object} Cloned node with substitutions
     */
    _substituteIdentifier(node, fromName, toName) {
      if (!node) return node;

      // Handle Identifier nodes
      if (node.type === 'Identifier' && node.name === fromName)
        return { ...node, name: toName };

      // Handle arrays
      if (Array.isArray(node))
        return node.map(item => this._substituteIdentifier(item, fromName, toName));

      // Handle objects (AST nodes)
      if (typeof node === 'object') {
        const result = {};
        for (const key in node) {
          if (key === 'parent') continue; // Skip circular refs
          result[key] = this._substituteIdentifier(node[key], fromName, toName);
        }
        return result;
      }

      return node;
    }

    /**
     * Heuristic to determine if an identifier is likely an array (for copying)
     * vs a numeric size (for size-based array creation)
     */
    _isLikelyArrayArgument(arg) {
      if (!arg) return false;

      // Get the identifier name
      let name = '';
      if (arg.type === 'Identifier')
        name = arg.name || '';
      else if (arg.type === 'MemberExpression' && arg.property?.name)
        name = arg.property.name;

      const lowerName = name.toLowerCase();

      // Names that clearly indicate an array to copy
      const arrayPatterns = /^(iv|state|key|block|data|buffer|bytes|array|input|output|hash|digest|result|chaining|round|s|k|w|h|v|m|t|p|x|y|z|sbox|table|rounds|perm|permutation|constants?|initial|values?|msg|message|plaintext|ciphertext|text|src|source|dest|target|words?|chunk|nonce|salt|seed|vector|matrix|schedule|expanded?)$/i;
      if (arrayPatterns.test(name))
        return true;

      // Names that clearly indicate a numeric size (check before array suffixes)
      const sizePatterns = /^(size|len|length|count|n|num|number|index|i|j|offset|pos|position|capacity|width|height|bits|bytes_?count|byte_?count)$/i;
      if (sizePatterns.test(name))
        return false;

      // Names with size-indicating prefixes (totalWords, numBytes, etc.) are sizes, not arrays
      const sizePrefixPatterns = /^(total|num|n_?|count_?|max_?|min_?|size_?).*$/i;
      if (sizePrefixPatterns.test(name))
        return false;

      // Names ending with size-like suffixes (wordCount, keyLength, etc.)
      const sizeSuffixPatterns = /(size|len|length|count|num|index|offset|bits)$/i;
      if (sizeSuffixPatterns.test(name))
        return false;

      // Names ending with array-like suffixes (e.g., initValues, subKeys, roundData)
      const arraySuffixPatterns = /(values?|keys?|bytes?|data|buffer|array|block|state|words?|rounds?)$/i;
      if (arraySuffixPatterns.test(name))
        return true;

      // Check type information if available
      const argType = arg.resultType || arg.typeInfo?.type;
      if (argType) {
        const typeStr = String(argType).toLowerCase();
        if (typeStr.includes('[]') || typeStr.includes('array') || typeStr.includes('uint'))
          return true;
        if (typeStr === 'int' || typeStr === 'int32' || typeStr === 'number' || typeStr === 'usize')
          return false;
      }

      // Default: if it's all uppercase (like IV, MSG, KEY), likely an array constant
      if (name === name.toUpperCase() && name.length <= 5 && name.length > 1)
        return true;

      // Default: assume size-based for safety (preserves original behavior)
      return false;
    }

    /**
     * Transform BufferCreation to JSArrayBuffer(size)
     * new ArrayBuffer(size) -> JSArrayBuffer(size) (see the JSArrayBuffer
     * HELPER_STUBS entry - a distinct JSUint8Array subclass so a later `new
     * Uint32Array(buffer)`/`new Float64Array(buffer)` view over it (see
     * _typed_array_view) is recognized as a real ArrayBuffer reinterpret
     * rather than an ordinary element-by-element array copy; still masks
     * stores to 8 bits like a real ArrayBuffer byte view does).
     */
    transformBufferCreation(node) {
      const size = node.size ? this.transformExpression(node.size) : null;
      if (size) {
        return new PythonCall(new PythonIdentifier('JSArrayBuffer'), [size]);
      }
      return new PythonCall(new PythonIdentifier('JSArrayBuffer'), []);
    }

    /**
     * Transform DataViewCreation to a memoryview over the backing buffer.
     * new DataView(buffer) -> memoryview(buffer)
     * new DataView(buffer, byteOffset[, byteLength]) -> memoryview(buffer)[byteOffset:...]
     *
     * DataViewRead/DataViewWrite (see transformArrayLength's siblings below)
     * both operate on the view via struct.pack_into/unpack_from and plain
     * subscripting, which is exactly what a memoryview supports directly -
     * and, unlike a hand-rolled wrapper class, a memoryview slice still
     * writes through to the original buffer (matching JS DataView semantics
     * where the view aliases the buffer rather than copying it). This
     * previously emitted calls to a "DataView(...)" Python class that was
     * never actually defined anywhere in the generated output.
     */
    transformDataViewCreation(node) {
      // `new DataView(X.buffer, X.byteOffset, X.byteLength)` (e.g. lsh.js's
      // `new DataView(msgblk.buffer, msgblk.byteOffset, msgblk.byteLength)`,
      // reinterpreting a byte array's own backing buffer as a view) - same
      // `.buffer` peel as transformTypedArrayCreation's isBufferPeel case
      // (see its doc comment): nothing in this runtime models a typed array
      // as a separate buffer-plus-view pair, a byte list/bytearray already
      // *is* its own backing buffer here, so a literal `.buffer` attribute
      // read on it is an AttributeError waiting to happen. Unwrap `X.buffer`
      // to plain `X` so the view is built from X's own bytes.
      const isBufferPeel = node.buffer && node.buffer.type === 'MemberExpression' &&
        !node.buffer.computed &&
        (node.buffer.property?.name === 'buffer' || node.buffer.property?.value === 'buffer');
      const bufferNode = isBufferPeel ? node.buffer.object : node.buffer;
      const buffer = bufferNode
        ? this.transformExpression(bufferNode)
        : new PythonCall(new PythonIdentifier('bytearray'), []);
      const view = new PythonCall(new PythonIdentifier('memoryview'), [buffer]);
      if (!node.byteOffset) return view;
      // `X.byteOffset`/`X.byteLength` alongside a peeled `X.buffer` (same
      // reasoning as the peel above) - X is modeled as its own whole buffer
      // here, not a sub-view into a larger one, so its "byteOffset" is always
      // 0 and its "byteLength" is just its own length. A literal member
      // access for either would AttributeError on the plain bytearray/list.
      const isByteOffsetPeel = isBufferPeel && node.byteOffset.type === 'MemberExpression' &&
        !node.byteOffset.computed && node.byteOffset.property?.name === 'byteOffset';
      const offset = isByteOffsetPeel ? PythonLiteral.Int(0) : this.transformExpression(node.byteOffset);
      let end = null;
      if (node.byteLength) {
        const isByteLengthPeel = isBufferPeel && node.byteLength.type === 'MemberExpression' &&
          !node.byteLength.computed && node.byteLength.property?.name === 'byteLength';
        const length = isByteLengthPeel
          ? new PythonCall(new PythonIdentifier('_js_len'), [buffer])
          : this.transformExpression(node.byteLength);
        end = new PythonBinaryExpression(offset, '+', length);
      }
      return new PythonSubscript(view, new PythonSlice(offset, end));
    }

    /**
     * Transform MapCreation to dict()
     * new Map() -> {} or dict()
     * new Map([entries]) -> dict(entries) or {k: v for k, v in entries}
     */
    transformMapCreation(node) {
      // PythonDict defaults useJSObject to true (see its constructor) - a
      // *real* `new Map()` must override that to false and stay a plain
      // dict, unlike a plain `{}` object literal (which DOES want the
      // JSObject wrapper, for JS-style dotted attribute access). JS Map
      // keys are never coerced (Map.set(5, x) and Map.set('5', y) are
      // distinct entries) - JSObject's __getitem__/__setitem__ deliberately
      // stringify every key via its _k() helper to match *plain object*
      // property-key coercion, which is correct for `{}` but silently
      // turns every non-string Map key into its string form instead.
      // surface-code.js's `new Map()` used as `Map<number, number>` (qubit
      // index -> occurrence count) hit exactly this: entries() handed back
      // string keys, and comparing one against an int later raised
      // "'>=' not supported between instances of 'str' and 'int'".
      if (node.entries && node.entries.elements && node.entries.elements.length > 0) {
        // Create dict with initial entries: {k1: v1, k2: v2, ...}
        const pairs = node.entries.elements.map(entry => {
          if (entry.elements && entry.elements.length >= 2) {
            const key = this.transformExpression(entry.elements[0]);
            const value = this.transformExpression(entry.elements[1]);
            return { key, value };
          }
          return null;
        }).filter(p => p !== null);

        return new PythonDict(pairs, false);
      }
      // Empty map: {}
      return new PythonDict([], false);
    }

    /**
     * Transform ByteBufferView to memoryview()
     */
    transformByteBufferView(node) {
      const buffer = this.transformExpression(node.buffer);
      return new PythonCall(new PythonIdentifier('memoryview'), [buffer]);
    }

    /**
     * Transform HexDecode to bytes.fromhex(string)
     * IL AST format: { type: 'HexDecode', arguments: [hexString] }
     */
    transformHexDecode(node) {
      // IL AST uses arguments array, fallback to value for compatibility
      const value = this.transformExpression(node.arguments?.[0] || node.value);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('bytes'), 'fromhex'),
        [value]
      );
    }

    /**
     * Transform HexEncode to array.hex()
     * IL AST format: { type: 'HexEncode', arguments: [byteArray] }
     */
    transformHexEncode(node) {
      // IL AST uses arguments array, fallback to value for compatibility
      const value = this.transformExpression(node.arguments?.[0] || node.value);
      return new PythonCall(new PythonMemberAccess(value, 'hex'), []);
    }

    /**
     * Transform Floor to int(x) for simple cases or math.floor(x)
     */
    transformFloor(node) {
      // The argument needs the true float quotient of any `/` inside it -
      // see the matching comment on the 'preserveFloatDivision' flag in
      // transformBinaryExpression's '/' handling and the MathCall case
      // above for the concrete bug (kdf1.js's Math.ceil) this prevents.
      // This dedicated IL 'Floor'/'Ceil'/etc. node (singular `.argument`)
      // is the path the type-aware parser actually emits for Math.floor/
      // Math.ceil/etc. calls - the generic 'MathCall' case handles the
      // same methods only when they DON'T get recognized as one of these
      // dedicated node types, so both must set the flag.
      const prevPreserveFloatDivision = this.preserveFloatDivision;
      this.preserveFloatDivision = true;
      const argument = this.transformExpression(node.argument);
      this.preserveFloatDivision = prevPreserveFloatDivision;
      // Python's int() truncates toward zero, math.floor() rounds down
      // For consistency with JavaScript, use int() for positive, math.floor for general
      this.imports.add('math');
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'floor'),
        [argument]
      );
    }

    /**
     * Transform Ceil to math.ceil(x)
     */
    transformCeil(node) {
      this.imports.add('math');
      const prevPreserveFloatDivision = this.preserveFloatDivision;
      this.preserveFloatDivision = true;
      const argument = this.transformExpression(node.argument);
      this.preserveFloatDivision = prevPreserveFloatDivision;
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'ceil'),
        [argument]
      );
    }

    /**
     * Transform Abs to abs(x)
     */
    transformAbs(node) {
      const argument = this.transformExpression(node.argument);
      return new PythonCall(new PythonIdentifier('abs'), [argument]);
    }

    /**
     * Transform Min to min(a, b, ...)
     */
    transformMin(node) {
      const args = (node.arguments || []).map(arg => this.transformExpression(arg));
      return new PythonCall(new PythonIdentifier('min'), args);
    }

    /**
     * Transform Max to max(a, b, ...)
     */
    transformMax(node) {
      const args = (node.arguments || []).map(arg => this.transformExpression(arg));
      return new PythonCall(new PythonIdentifier('max'), args);
    }

    /**
     * Transform Pow to pow(base, exp) or base ** exp
     */
    transformPow(node) {
      const base = this.transformExpression(node.base);
      const exponent = this.transformExpression(node.exponent);
      return new PythonBinaryExpression(base, '**', exponent);
    }

    /**
     * Transform Round to round(x)
     */
    transformRound(node) {
      const prevPreserveFloatDivision = this.preserveFloatDivision;
      this.preserveFloatDivision = true;
      const argument = this.transformExpression(node.argument);
      this.preserveFloatDivision = prevPreserveFloatDivision;
      return new PythonCall(new PythonIdentifier('round'), [argument]);
    }

    /**
     * Transform Trunc to int(x)
     */
    transformTrunc(node) {
      const prevPreserveFloatDivision = this.preserveFloatDivision;
      this.preserveFloatDivision = true;
      const argument = this.transformExpression(node.argument);
      this.preserveFloatDivision = prevPreserveFloatDivision;
      return new PythonCall(new PythonIdentifier('int'), [argument]);
    }

    /**
     * Transform Sign to (1 if x > 0 else -1 if x < 0 else 0)
     */
    transformSign(node) {
      const argument = this.transformExpression(node.argument);
      // Python doesn't have a direct sign function, use conditional
      // (1 if x > 0 else (-1 if x < 0 else 0))
      return new PythonConditional(
        PythonLiteral.Int(1),
        new PythonBinaryExpression(argument, '>', PythonLiteral.Int(0)),
        new PythonConditional(
          PythonLiteral.Int(-1),
          new PythonBinaryExpression(argument, '<', PythonLiteral.Int(0)),
          PythonLiteral.Int(0)
        )
      );
    }

    /**
     * Transform Random to random.random()
     */
    transformRandom(node) {
      this.imports.add('random');
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('random'), 'random'),
        []
      );
    }

    /**
     * Transform Imul to 32-bit multiplication: (a * b) & 0xFFFFFFFF
     */
    transformImul(node) {
      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);
      const multiply = new PythonBinaryExpression(left, '*', right);
      return new PythonBinaryExpression(multiply, '&', PythonLiteral.Int(0xFFFFFFFF));
    }

    /**
     * Transform Clz32 to count leading zeros
     * Python 3.10+: (32 - x.bit_length()) if x else 32
     */
    transformClz32(node) {
      const argument = this.transformExpression(node.argument);
      // (32 - (x & 0xFFFFFFFF).bit_length()) if x else 32
      const masked = new PythonBinaryExpression(argument, '&', PythonLiteral.Int(0xFFFFFFFF));
      const bitLength = new PythonCall(new PythonMemberAccess(masked, 'bit_length'), []);
      const result = new PythonBinaryExpression(PythonLiteral.Int(32), '-', bitLength);
      return new PythonConditional(result, argument, PythonLiteral.Int(32));
    }

    /**
     * Transform Cast to appropriate Python casting
     */
    transformCast(node) {
      // IL AST uses node.arguments[0], fallback to node.expression for compatibility
      const argNode = node.arguments?.[0] || node.expression;
      const targetType = node.targetType;

      // A ToUint32/ToInt32 cast is JavaScript's own signal that this whole
      // expression is a plain Number being truncated to 32 bits - the exact
      // context where a raw `*` inside it needs the double-precision-
      // rounding replica (see _lowerAsFloat64Chain's doc comment for the
      // full rationale, including why the *entire* +/-/* chain - not just
      // the innermost multiply - has to be lowered together).
      if ((targetType === 'uint32' || targetType === 'int32') && PythonTransformer._treeHasFloat64Mul(argNode)) {
        const floatChain = this._lowerAsFloat64Chain(argNode);
        const asInt = new PythonCall(new PythonIdentifier('int'), [floatChain]);
        return new PythonBinaryExpression(asInt, '&', PythonLiteral.Int(0xFFFFFFFF));
      }

      const expression = this.transformExpression(argNode);

      // Note: The emitter's precedence system handles parentheses automatically
      // when creating BinaryExpression with lower-precedence operators

      switch (targetType) {
        case 'uint32':
        case 'int32':
          // Mask to 32-bit
          return new PythonBinaryExpression(expression, '&', PythonLiteral.Int(0xFFFFFFFF));
        case 'uint16':
        case 'int16':
          return new PythonBinaryExpression(expression, '&', PythonLiteral.Int(0xFFFF));
        case 'uint8':
        case 'int8':
        case 'byte':
          return new PythonBinaryExpression(expression, '&', PythonLiteral.Int(0xFF));
        case 'uint64':
          // OpCodes.ToQWord(x) operates on BigInt/int state (64-bit PRNGs/hashes
          // like xoshiro/xoroshiro/splitmix64/Tiger/Skein/SHA-512). Python ints
          // are arbitrary precision just like JS BigInt, so the truncation must
          // be done explicitly here too — falling through to the "just return
          // expression" default silently dropped this mask, letting state grow
          // unbounded and diverge from the reference implementation.
          return new PythonBinaryExpression(expression, '&', PythonLiteral.Int(0xFFFFFFFFFFFFFFFFn));
        case 'int64':
          // Signed 64-bit: mask then reinterpret values >= 2^63 as negative.
          return new PythonCall(new PythonIdentifier('OpCodes.ToLong'), [expression]);
        case 'int':
        case 'integer':
          return new PythonCall(new PythonIdentifier('int'), [expression]);
        case 'float':
        case 'double':
          return new PythonCall(new PythonIdentifier('float'), [expression]);
        case 'string':
        case 'str':
          return new PythonCall(new PythonIdentifier('str'), [expression]);
        case 'boolean':
        case 'bool':
          return new PythonCall(new PythonIdentifier('bool'), [expression]);
        default:
          // Unknown cast, just return expression
          return expression;
      }
    }

    /**
     * Transform DestructuringAssignment to tuple unpacking
     */
    transformDestructuringAssignment(node) {
      const source = this.transformExpression(node.source);
      const targets = (node.properties || []).map(prop => {
        const name = typeof prop === 'string' ? prop : (prop.key || prop.name || prop);
        return new PythonIdentifier(toSnakeCase(name));
      });

      if (targets.length === 0) {
        return source;
      }

      // Create tuple unpacking
      const tupleTarget = new PythonTuple(targets);
      return new PythonAssignment(tupleTarget, source);
    }

    // ========================[ TYPE MAPPING ]========================

    mapType(typeNode) {
      if (!typeNode) return null;

      // Handle string type annotations
      if (typeof typeNode === 'string') {
        const mapped = TYPE_MAP[typeNode] || typeNode;
        return this.createPythonType(mapped);
      }

      // Handle TSTypeAnnotation wrapper
      if (typeNode.type === 'TSTypeAnnotation') {
        return this.mapType(typeNode.typeAnnotation);
      }

      // Handle specific type node types
      switch (typeNode.type) {
        case 'TSNumberKeyword':
          return PythonType.Int();
        case 'TSStringKeyword':
          return PythonType.Str();
        case 'TSBooleanKeyword':
          return PythonType.Bool();
        case 'TSVoidKeyword':
        case 'TSUndefinedKeyword':
        case 'TSNullKeyword':
          return PythonType.None();
        case 'TSAnyKeyword':
          return this.getAnyType();
        case 'TSArrayType':
          const elementType = this.mapType(typeNode.elementType);
          this.imports.add('List');
          return PythonType.List(elementType);
        case 'TSTypeReference':
          return this.mapTypeReference(typeNode);
        default:
          return this.getAnyType();
      }
    }

    mapTypeReference(typeNode) {
      const typeName = typeNode.typeName.name;
      const mapped = TYPE_MAP[typeName] || typeName;

      if (mapped === 'List' && typeNode.typeParameters) {
        this.imports.add('List');
        const elementType = this.mapType(typeNode.typeParameters.params[0]);
        return PythonType.List(elementType);
      }

      if (mapped === 'Dict' && typeNode.typeParameters) {
        this.imports.add('Dict');
        const keyType = this.mapType(typeNode.typeParameters.params[0]);
        const valueType = this.mapType(typeNode.typeParameters.params[1]);
        return PythonType.Dict(keyType, valueType);
      }

      return this.createPythonType(mapped);
    }

    createPythonType(typeName) {
      switch (typeName) {
        case 'int':
          return PythonType.Int();
        case 'float':
          return PythonType.Float();
        case 'bool':
          return PythonType.Bool();
        case 'str':
          return PythonType.Str();
        case 'bytes':
          return PythonType.Bytes();
        case 'None':
          return PythonType.None();
        case 'Any':
          this.imports.add('Any');
          return PythonType.Any();
        default:
          return new PythonType(typeName);
      }
    }

    registerImportForType(type) {
      if (!type) return;

      if (type.isList) {
        this.imports.add('List');
      }
      if (type.isDict) {
        this.imports.add('Dict');
      }
      if (type.isOptional) {
        this.imports.add('Optional');
      }
      if (type.name === 'Any') {
        this.imports.add('Any');
      }
    }

    /**
     * Fallback for the legacy `function Ctor(){...}` + `Ctor.prototype =
     * Object.create(Base.prototype)` inheritance idiom (as opposed to ES6
     * `class Ctor extends Base`) - see aead/paef-forkskinny.js's
     * PAEFForkSkinny128_192Algorithm. type-aware-transpiler.js's own
     * flattening pass (flattenMethodDefinitions/extractPrototypeAssignment)
     * only recognizes `Ctor.prototype.methodName = function(){}` (a METHOD
     * assignment, which it merges into a synthesized class - the reason
     * `CreateInstance` already ends up as a method on the class by the time
     * this transformer sees it) - it has no matching case for the
     * INHERITANCE-establishing statement itself (`Ctor.prototype =
     * Object.create(Base.prototype)`) or the immediately following
     * `Ctor.prototype.constructor = Ctor` (a pure JS runtime-introspection
     * fixup, meaningless once Python's own class/bases model expresses the
     * same inheritance). Left alone, both statements survive as literal
     * top-level assignment expressions and get transpiled generically into
     * nonsensical, immediately-fatal Python: `Ctor.prototype =
     * JSObject(dict(getattr(Base, "prototype", None)))` - a plain class
     * object has no runtime `.prototype` to read, so `getattr(...,
     * None)` piped into `dict(...)` raises "'NoneType' object is not
     * iterable" the moment the module loads.
     *
     * Recognizes the pattern directly on the Program body: sets the
     * matching ClassDeclaration's `superClass` (synthesizing one from a
     * bare FunctionDeclaration first, on the rare chance type-aware-
     * transpiler.js's own pass never had a reason to - i.e. no OTHER
     * `Ctor.prototype.method = ...` assignment triggered it), then drops
     * both now-meaningless statements so they never reach the generic
     * assignment-expression transform.
     */
    _flattenLegacyPrototypeOOP(programNode) {
      if (!programNode || !Array.isArray(programNode.body)) return;

      const body = programNode.body;
      const toRemove = new Set();

      const isPlainMember = (n, propName) =>
        n && n.type === 'MemberExpression' && !n.computed &&
        n.object && n.object.type === 'Identifier' &&
        n.property && (n.property.name === propName || n.property.value === propName);

      for (const stmt of body) {
        if (stmt.type !== 'ExpressionStatement') continue;
        const expr = stmt.expression;
        if (!expr || expr.type !== 'AssignmentExpression' || expr.operator !== '=') continue;
        const left = expr.left;

        // Ctor.prototype = Object.create(Base.prototype)
        if (isPlainMember(left, 'prototype') && expr.right && expr.right.type === 'ObjectCreate') {
          const className = left.object.name;
          const protoArg = expr.right.prototype;
          const baseName = isPlainMember(protoArg, 'prototype') ? protoArg.object.name : null;
          if (baseName) {
            let classDecl = body.find(s => s.type === 'ClassDeclaration' && s.id && s.id.name === className);
            if (!classDecl) classDecl = this._synthesizeClassFromFunctionDeclaration(body, className);
            if (classDecl && !classDecl.superClass) classDecl.superClass = { type: 'Identifier', name: baseName };
          }
          toRemove.add(stmt);
          continue;
        }

        // Ctor.prototype.constructor = Ctor
        if (left && left.type === 'MemberExpression' && !left.computed &&
            left.property && (left.property.name === 'constructor' || left.property.value === 'constructor') &&
            isPlainMember(left.object, 'prototype') &&
            expr.right && expr.right.type === 'Identifier' && expr.right.name === left.object.object.name) {
          toRemove.add(stmt);
        }
      }

      if (toRemove.size > 0) programNode.body = body.filter(s => !toRemove.has(s));
    }

    /**
     * Synthesize a ClassDeclaration for a bare `function Ctor(){...}` that
     * has no OTHER `Ctor.prototype.method = ...` assignment to trigger
     * type-aware-transpiler.js's own class synthesis - only the inheritance
     * assignment itself (`_flattenLegacyPrototypeOOP`'s doc comment).
     * Mirrors that same synthesis shape (constructor function body -> a
     * single 'constructor' MethodDefinition) so both code paths produce an
     * equivalent class.
     */
    _synthesizeClassFromFunctionDeclaration(body, className) {
      const idx = body.findIndex(s => s.type === 'FunctionDeclaration' && s.id && s.id.name === className);
      if (idx === -1) return null;
      const fn = body[idx];
      const classDecl = {
        type: 'ClassDeclaration',
        id: { type: 'Identifier', name: className },
        superClass: null,
        body: {
          type: 'ClassBody',
          body: [{
            type: 'MethodDefinition',
            kind: 'constructor',
            static: false,
            computed: false,
            key: { type: 'Identifier', name: 'constructor' },
            value: { type: 'FunctionExpression', params: fn.params || [], body: fn.body, async: false, generator: false }
          }]
        }
      };
      body[idx] = classDecl;
      return classDecl;
    }

    /**
     * Populate `this._jsonPreserveKeyLiterals`: the Set of 'ObjectLiteral'/
     * 'ObjectExpression' IL nodes whose property keys must keep their raw JS
     * spelling once serialized, even though the literal itself isn't written
     * directly inside a `JSON.stringify(...)` call - unlike the
     * 'JsonSerialize' case's `_preserveJsonObjectKeys` counter, which only
     * catches that direct-nesting case (see its doc comment).
     *
     * A bounded, per-class "light dataflow" trace: starting from each
     * JSON.stringify argument found anywhere in the class, follow bare
     * Identifier references back to their origin - a local `const x =
     * <expr>` declaration (recursing into a called method's own return
     * value when `expr` is a method call), or, for a function PARAMETER,
     * back through every call site of that same method elsewhere in the
     * class. E.g. compression/deflate-simple.js: `_applyHuffman` returns
     * `{ codes, encodedBits }` into a local variable, which is passed
     * straight through as `_packCompressedData`'s `huffmanResult`
     * parameter, which THAT method embeds in
     * `JSON.stringify({ huffmanResult, originalLength })` - the literal that
     * actually needs its keys preserved (`_applyHuffman`'s `return`) is
     * three hops away from the JSON.stringify call site itself.
     *
     * Deliberately scoped to a single class at a time (unrelated classes
     * routinely reuse generic helper/parameter names like "result";
     * resolving across class boundaries would risk tainting an unrelated
     * literal) and deliberately bounded - a visited-set-guarded worklist
     * over straight-line assign/call/return/parameter chains, not a general
     * points-to/aliasing solver.
     */
    _computeJsonPreserveKeyLiterals(programNode) {
      const preserveSet = new Set();
      this._jsonPreserveKeyLiterals = preserveSet;

      // Cheap bail-out: skip all of the below for the overwhelming majority
      // of files that never call JSON.stringify in the first place.
      if (!this._nodeContainsType(programNode, 'JsonSerialize')) return;

      // className -> Map<methodName, FunctionExpression-like node ({params, body})>
      const classesByName = new Map();
      this._collectClassMethods(programNode, classesByName);

      for (const [className, methods] of classesByName) {
        for (const [, fnNode] of methods) {
          if (!fnNode.body) continue;
          const jsonCalls = this._findNodesOfType(fnNode.body, 'JsonSerialize');
          if (jsonCalls.length === 0) continue;

          const roots = [];
          for (const callNode of jsonCalls) this._collectJsonTaintRoots(callNode.value, preserveSet, roots, fnNode);

          const visited = new Map(); // fnNode -> Set(names already resolved in it)
          while (roots.length > 0) {
            const { name, fnNode: scopeFn } = roots.pop();
            this._resolveJsonTaintedName(name, scopeFn, className, classesByName, preserveSet, roots, visited);
          }
        }
      }
    }

    /** True if `node` (or any descendant) has `.type === typeName`. */
    _nodeContainsType(node, typeName) {
      if (!node || typeof node !== 'object') return false;
      if (node.type === typeName) return true;
      for (const key in node) {
        if (key === 'parent') continue;
        const v = node[key];
        if (Array.isArray(v)) {
          for (const item of v) if (this._nodeContainsType(item, typeName)) return true;
        } else if (v && typeof v === 'object') {
          if (this._nodeContainsType(v, typeName)) return true;
        }
      }
      return false;
    }

    /** Collect every descendant node with `.type === typeName` into an array. */
    _findNodesOfType(node, typeName, into = []) {
      if (!node || typeof node !== 'object') return into;
      if (node.type === typeName) { into.push(node); return into; }
      for (const key in node) {
        if (key === 'parent') continue;
        const v = node[key];
        if (Array.isArray(v)) for (const item of v) this._findNodesOfType(item, typeName, into);
        else if (v && typeof v === 'object') this._findNodesOfType(v, typeName, into);
      }
      return into;
    }

    /** className -> Map<methodName, FunctionExpression node> for every ClassDeclaration in the program. */
    _collectClassMethods(node, classesByName) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'ClassDeclaration' && node.id && node.id.name) {
        const methods = new Map();
        for (const member of ((node.body && node.body.body) || [])) {
          if (member.type === 'MethodDefinition' && member.key && member.key.name && member.value) {
            methods.set(member.key.name, member.value);
          }
        }
        classesByName.set(node.id.name, methods);
      }
      for (const key in node) {
        if (key === 'parent') continue;
        const v = node[key];
        if (Array.isArray(v)) for (const item of v) this._collectClassMethods(item, classesByName);
        else if (v && typeof v === 'object') this._collectClassMethods(v, classesByName);
      }
    }

    /**
     * Recursively descend into a JSON.stringify(...) argument (or any value
     * it flows from), marking every 'ObjectLiteral'/'ObjectExpression' node
     * reached along the way and collecting `{name, fnNode}` roots for any
     * bare Identifier reached (a value this literal's own property refers
     * to, needing further resolution back to ITS origin).
     */
    _collectJsonTaintRoots(node, preserveSet, roots, fnNode) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'ObjectLiteral') {
        preserveSet.add(node);
        for (const prop of (node.properties || [])) {
          if (prop.type === 'ObjectProperty') this._collectJsonTaintRoots(prop.value, preserveSet, roots, fnNode);
        }
        return;
      }
      if (node.type === 'ObjectExpression') {
        preserveSet.add(node);
        for (const prop of (node.properties || [])) {
          if (prop.type === 'Property') this._collectJsonTaintRoots(prop.value, preserveSet, roots, fnNode);
        }
        return;
      }
      if (node.type === 'Identifier' && node.name) {
        roots.push({ name: node.name, fnNode });
        return;
      }
      if (node.type === 'ArrayExpression' || node.type === 'ArrayLiteral') {
        for (const el of (node.elements || [])) this._collectJsonTaintRoots(el, preserveSet, roots, fnNode);
      }
      // Anything else (literals, computed/binary expressions, ...) carries
      // no traceable name to resolve further - nothing more to do.
    }

    /**
     * Resolve one `{name, fnNode}` taint root within `className`: either a
     * local variable declaration (recursing into a called method's return
     * value) or a function parameter (recursing into every call site of
     * `fnNode`'s own method elsewhere in the class).
     */
    _resolveJsonTaintedName(name, fnNode, className, classesByName, preserveSet, roots, visited) {
      if (!fnNode || !name) return;
      let seenNames = visited.get(fnNode);
      if (!seenNames) { seenNames = new Set(); visited.set(fnNode, seenNames); }
      if (seenNames.has(name)) return;
      seenNames.add(name);

      const body = fnNode.body;
      if (!body) return;

      // 1) A local `const/let name = <expr>` declaration inside this function.
      const decl = this._findVariableDeclarator(body, name);
      if (decl && decl.init) {
        const init = decl.init;
        if (init.type === 'ObjectLiteral' || init.type === 'ObjectExpression') {
          this._collectJsonTaintRoots(init, preserveSet, roots, fnNode);
        } else if ((init.type === 'ThisMethodCall' || init.type === 'CallExpression') && init.method) {
          const calleeFn = classesByName.get(className) && classesByName.get(className).get(init.method);
          if (calleeFn && calleeFn.body) {
            for (const retArg of this._findReturnArguments(calleeFn.body)) {
              this._collectJsonTaintRoots(retArg, preserveSet, roots, calleeFn);
            }
          }
        } else if (init.type === 'Identifier' && init.name) {
          roots.push({ name: init.name, fnNode });
        }
        return;
      }

      // 2) A parameter of this function - resolve backward through every
      // call site (within the same class) that invokes THIS method by name.
      const params = fnNode.params || [];
      const paramIndex = params.findIndex(p => p && p.name === name);
      if (paramIndex === -1) return;

      const methods = classesByName.get(className);
      if (!methods) return;
      let ownName = null;
      for (const [mName, mFn] of methods) { if (mFn === fnNode) { ownName = mName; break; } }
      if (!ownName) return;

      for (const [, otherFn] of methods) {
        if (!otherFn.body) continue;
        for (const call of this._findMethodCallsByName(otherFn.body, ownName)) {
          const argNode = (call.arguments || [])[paramIndex];
          if (argNode) this._collectJsonTaintRoots(argNode, preserveSet, roots, otherFn);
        }
      }
    }

    /** Find the first `VariableDeclarator` for `name` (with a non-null init) anywhere under `node`. */
    _findVariableDeclarator(node, name) {
      if (!node || typeof node !== 'object') return null;
      if (node.type === 'VariableDeclaration') {
        for (const d of (node.declarations || [])) {
          if (d.type === 'VariableDeclarator' && d.id && d.id.name === name && d.init) return d;
        }
      }
      for (const key in node) {
        if (key === 'parent') continue;
        const v = node[key];
        if (Array.isArray(v)) {
          for (const item of v) { const r = this._findVariableDeclarator(item, name); if (r) return r; }
        } else if (v && typeof v === 'object') {
          const r = this._findVariableDeclarator(v, name);
          if (r) return r;
        }
      }
      return null;
    }

    /** Collect every ReturnStatement's argument (when present) anywhere under `node`. */
    _findReturnArguments(node, into = []) {
      if (!node || typeof node !== 'object') return into;
      if (node.type === 'ReturnStatement' && node.argument) into.push(node.argument);
      for (const key in node) {
        if (key === 'parent') continue;
        const v = node[key];
        if (Array.isArray(v)) for (const item of v) this._findReturnArguments(item, into);
        else if (v && typeof v === 'object') this._findReturnArguments(v, into);
      }
      return into;
    }

    /** Collect every ThisMethodCall/CallExpression invoking `methodName` anywhere under `node`. */
    _findMethodCallsByName(node, methodName, into = []) {
      if (!node || typeof node !== 'object') return into;
      if ((node.type === 'ThisMethodCall' || node.type === 'CallExpression') && node.method === methodName) into.push(node);
      for (const key in node) {
        if (key === 'parent') continue;
        const v = node[key];
        if (Array.isArray(v)) for (const item of v) this._findMethodCallsByName(item, methodName, into);
        else if (v && typeof v === 'object') this._findMethodCallsByName(v, methodName, into);
      }
      return into;
    }

    /**
     * Recursively walk a method body (or any subtree) collecting the raw JS
     * name of every bare-Identifier argument passed to a transcendental math
     * function ('Log2'/'Log'/'Log10'/'Exp' - the shared parser's dedicated
     * IL node types for Math.log2/log/log10/exp) into `into`. See the
     * `_transcendentalArgNames` doc comment (constructor) for why: a
     * variable fed to one of these later in the SAME method needs its
     * defining division to stay a true float division, which the local
     * per-operand heuristic (isFloatOperand) can't see on its own.
     */
    _collectTranscendentalArgNames(node, into) {
      if (!node || typeof node !== 'object') return;
      if ((node.type === 'Log2' || node.type === 'Log' || node.type === 'Log10' || node.type === 'Exp') &&
          node.argument && node.argument.type === 'Identifier' && node.argument.name) {
        into.add(node.argument.name);
      }
      for (const key in node) {
        if (key === 'parent') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          for (const item of value) this._collectTranscendentalArgNames(item, into);
        } else if (value && typeof value === 'object') {
          this._collectTranscendentalArgNames(value, into);
        }
      }
    }

    /**
     * Recursively walk a method body collecting the raw JS name of every
     * bare Identifier compared against a literal `undefined` (`x ===
     * undefined`/`x !== undefined`/`==`/`!=`, either operand order) into
     * `into`. See the `_undefinedCheckedVarNames` doc comment (constructor)
     * for why: a variable this method later null-checks like this needs a
     * JS-faithful (None-on-miss, never-raising) read for whatever produced
     * its value.
     */
    _collectUndefinedCheckedNames(node, into) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'BinaryExpression' && ['===', '!==', '==', '!='].includes(node.operator)) {
        const isUndefinedLiteral = (n) => n && ((n.type === 'Literal' && n.resultType === 'void') ||
          (n.type === 'Identifier' && n.name === 'undefined'));
        const other = isUndefinedLiteral(node.right) ? node.left : (isUndefinedLiteral(node.left) ? node.right : null);
        if (other && other.type === 'Identifier' && other.name) into.add(other.name);
      }
      for (const key in node) {
        if (key === 'parent') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          for (const item of value) this._collectUndefinedCheckedNames(item, into);
        } else if (value && typeof value === 'object') {
          this._collectUndefinedCheckedNames(value, into);
        }
      }
    }

    /**
     * Check if an AST node contains a division operator that could produce a float
     * JavaScript division of integers produces float, Python division also produces float
     */
    _containsDivision(node) {
      if (!node) return false;
      // Check if this node is a binary expression with division
      if (node.type === 'BinaryExpression') {
        if (node.operator === '/') return true;
        // Recursively check operands
        return this._containsDivision(node.left) || this._containsDivision(node.right);
      }
      // Check call expressions - arguments might contain division
      if (node.type === 'CallExpression') {
        if (node.arguments && node.arguments.some(arg => this._containsDivision(arg)))
          return true;
        if (this._containsDivision(node.callee))
          return true;
      }
      // Check member expressions
      if (node.type === 'MemberExpression') {
        return this._containsDivision(node.object);
      }
      // Check unary expressions
      if (node.type === 'UnaryExpression') {
        return this._containsDivision(node.argument);
      }
      // Check conditional/ternary
      if (node.type === 'ConditionalExpression') {
        return this._containsDivision(node.consequent) || this._containsDivision(node.alternate);
      }
      // Check array expressions
      if (node.type === 'ArrayExpression' && node.elements) {
        return node.elements.some(el => this._containsDivision(el));
      }
      return false;
    }

    /**
     * Get the return value from an IIFE if it has one
     */
    getIIFEReturnValue(callNode) {
      const func = callNode.callee;
      if (!func.body || func.body.type !== 'BlockStatement') {
        // Arrow function with expression body - the body IS the return value
        if (func.body) return func.body;
        return null;
      }

      // Look for a return statement at the end of the function body
      const body = func.body.body;
      if (!body || body.length === 0) return null;

      const lastStmt = body[body.length - 1];
      if (lastStmt.type === 'ReturnStatement' && lastStmt.argument)
        return lastStmt.argument;

      return null;
    }

    // ========================[ ARRAY HIGHER-ORDER FUNCTIONS ]========================

    /**
     * Transform ArrayForEach to for loop
     * Python: for item in array: callback(item)
     */
    transformArrayForEach(node) {
      const array = this.transformExpression(node.array);
      const callback = node.callback;

      // Extract the actual callback parameter name instead of hardcoding _item
      let paramName = '_item';
      if (callback && callback.params && callback.params.length > 0) {
        const param = callback.params[0];
        paramName = param.name || param.value || '_item';
        paramName = toSnakeCase(paramName);
      }
      const itemVar = new PythonIdentifier(paramName);

      // arr.forEach((item, index) => ...) - a 2nd callback param names the
      // element's index (JS forEach's 2nd argument). Without this,
      // `index`/whatever it's called stayed referenced-but-undeclared in
      // the loop body -> NameError. Python's enumerate() yields
      // (index, item), the reverse of JS's (item, index) callback order, so
      // the loop target tuple is built index-first while the iterable stays
      // in element order via enumerate(array).
      let iterable = array;
      let loopVar = itemVar;
      if (callback && callback.params && callback.params.length > 1) {
        const idxParam = callback.params[1];
        const idxName = toSnakeCase(idxParam.name || idxParam.value || '_index');
        iterable = new PythonCall(new PythonIdentifier('enumerate'), [array]);
        loopVar = new PythonTuple([new PythonIdentifier(idxName), itemVar]);
      }
      let body;

      if (callback && callback.body) {
        // Check if body is a statement or an expression
        // Arrow functions with expression bodies have the expression directly as body
        const callbackBody = callback.body;
        if (callbackBody.type === 'BlockStatement') {
          // Block statement - transform as normal
          body = this.transformStatement(callbackBody);
        } else if (callbackBody.type === 'ExpressionStatement') {
          // Expression statement - transform as statement
          body = this.transformStatement(callbackBody);
        } else if (callbackBody.type) {
          // It's an expression node - wrap it as an expression statement
          const expr = this.transformExpression(callbackBody);
          if (expr) {
            body = new PythonBlock();
            body.statements = [new PythonExpressionStatement(expr)];
          } else {
            body = new PythonBlock();
            body.statements = [new PythonPass()];
          }
        } else {
          // Unknown type - use pass
          body = new PythonBlock();
          body.statements = [new PythonPass()];
        }
      } else {
        body = new PythonBlock();
        body.statements = [new PythonPass()];
      }

      return new PythonFor(loopVar, iterable, body);
    }

    /**
     * Resolve an Array.prototype callback (map/filter/some/every/find/findIndex/
     * reduce) to a Python expression usable inside a comprehension/generator.
     *
     * Simple expression-bodied arrows ((x) => x * 2) transform directly, as
     * before. Block-bodied arrows ((x) => { const y = f(x); return y; }) can't
     * be embedded in a Python comprehension (statements aren't expressions),
     * so they are hoisted into a nested helper function definition (added to
     * pendingPreStatements, emitted before the current statement) and the
     * comprehension calls that function instead. Without this, block bodies
     * used to hit the "Unhandled expression type: BlockStatement" fallback.
     *
     * @param {object} callback - the arrow/function IL node
     * @param {PythonIdentifier[]} paramVars - already-built Python identifiers
     *   for the callback's parameters, in JS declaration order
     */
    transformCallbackExpr(callback, paramVars) {
      if (!callback) return paramVars[0] || PythonLiteral.None();

      // A bare function-REFERENCE callback (an Identifier/MemberExpression
      // value, not an inline arrow/function - so it has no `.body` at all) -
      // e.g. compression/fse.js's `Object.keys(frequencies).map(Number)`
      // (converting each stringified object-literal key back to a real
      // number) or a plain `.map(this.someHelper)` bound-method reference.
      // JS calls this reference AS a function with the loop's own params
      // (`fn(element, index, array)`); the old code fell all the way
      // through to the "no callback" early-return below, which just yields
      // the RAW loop variable unchanged - silently dropping the callback
      // entirely (fse.js's `symbols` ended up as the unconverted STRING
      // dict keys instead of ints, corrupting every later `normalized[symbol]
      // = ...` numeric-index write into a string-keyed access that plain
      // Python list indexing can't perform). Resolve well-known JS global
      // callables to their real Python equivalents first (mirroring
      // transformCallExpression's identical mapping for a direct `Number(x)`
      // call, which never runs here since this is a bare reference, not a
      // call node) - everything else (a local variable/parameter holding a
      // function, a bound method, another top-level function) is transformed
      // as a normal expression and simply called with the same arguments.
      if (!callback.body) {
        if (callback.type === 'Identifier') {
          const GLOBAL_CALLABLE_MAP = { 'Number': 'int', 'String': 'str', 'Boolean': 'bool', 'parseFloat': 'float' };
          if (GLOBAL_CALLABLE_MAP[callback.name])
            return new PythonCall(new PythonIdentifier(GLOBAL_CALLABLE_MAP[callback.name]), paramVars);
          if (callback.name === 'parseInt') {
            this.frameworkFunctions.add('_js_parse_int');
            return new PythonCall(new PythonIdentifier('_js_parse_int'), paramVars);
          }
        }
        return new PythonCall(this.transformExpression(callback), paramVars);
      }

      if (callback.body.type !== 'BlockStatement') {
        // Bind each declared parameter's ORIGINAL JS name to its
        // corresponding paramVars entry (positional) via
        // transformIdentifier's _identifierSubstitutions lookup - needed
        // for callers (see _bindArrayCallbackIndex) that pass a
        // substitution which ISN'T just "the same name as a fresh loop
        // variable" (e.g. the shared 3rd "array" callback parameter, which
        // must resolve to the actual array expression being iterated, not
        // a loop variable of its own). Plain single-expression arrow
        // bodies are transformed directly (no hoisted helper function), so
        // without this, any reference to that 3rd parameter would resolve
        // as an ordinary (nowhere-bound) identifier instead.
        const prevSubs = this._identifierSubstitutions;
        if (callback.params && callback.params.length > 0) {
          const subs = new Map();
          callback.params.forEach((p, i) => {
            const rawName = p && (p.name || p.value);
            if (rawName && paramVars[i]) subs.set(rawName, paramVars[i]);
          });
          this._identifierSubstitutions = subs;
        }
        try {
          return this.transformExpression(callback.body);
        } finally {
          this._identifierSubstitutions = prevSubs;
        }
      }

      this._callbackHelperCounter = (this._callbackHelperCounter || 0) + 1;
      const fnName = `_cb_${this._callbackHelperCounter}`;
      const params = paramVars.map(v => new PythonParameter(v.name));
      const func = new PythonFunction(fnName, params, null);
      // transformReturnStatement() treats "no currentMethod/currentClass"
      // as module-top-level UMD-export boilerplate and silently drops the
      // `return` (see its guard). A block-bodied callback hoisted here often
      // originates from module-scope code (e.g. `rawTables.map(raw => {
      // ...; return { hi, lo }; })` building a lookup table before any class
      // is defined), so without marking this hoisted helper as "inside a
      // function" too, its `return` was being dropped - the callback always
      // returned None, corrupting every element of the mapped/filtered/
      // reduced result.
      const prevMethod = this.currentMethod;
      this.currentMethod = func;
      func.body = this.transformBlockStatement(callback.body);
      this.currentMethod = prevMethod;

      if (!this.pendingPreStatements) this.pendingPreStatements = [];
      this.pendingPreStatements.push(func);

      return new PythonCall(new PythonIdentifier(fnName), paramVars);
    }

    /**
     * Transform ArrayMap to list comprehension
     * Python: [callback(x) for x in array] or [callback(x, i) for i, x in enumerate(array)]
     */
    /**
     * Shared index/array-aware callback binding for the Array.prototype
     * iteration methods below (map/filter/some/every), which all inline
     * the callback body as a plain Python comprehension/generator
     * expression rather than a real callable. JS always invokes these
     * callbacks as (element, index, array) regardless of how many
     * parameters the callback body actually declares - dropping unused
     * ones is fine, but when the callback DOES reference its 2nd/3rd
     * parameter (e.g. classical/foursquare.js's `.filter((char, index,
     * arr) => arr.indexOf(char) === index)`, deduplicating letters), those
     * names must resolve to the current index and the array being
     * iterated. Previously only transformArrayMap did this (for the index
     * only); transformArrayFilter/Some/Every substituted just the element,
     * leaving `index`/`arr` as free variables that resolve to whatever
     * unrelated same-named binding happens to be in scope (or NameError) -
     * silently corrupting the result rather than raising.
     * Returns { itemVar, substitutions, loopTarget, iterable }:
     * `substitutions` feeds transformCallbackExpr; `loopTarget`/`iterable`
     * are the comprehension's `for <loopTarget> in <iterable>` clause.
     */
    _bindArrayCallbackIndex(array, callback) {
      let paramName = '_x';
      let indexName = null;
      let hasArrayParam = false;
      if (callback && callback.params && callback.params.length > 0) {
        const param = callback.params[0];
        paramName = toSnakeCase(param.name || param.value || '_x');
        if (callback.params.length >= 2) {
          const indexParam = callback.params[1];
          indexName = toSnakeCase(indexParam.name || indexParam.value || '_i');
        }
        if (callback.params.length >= 3) hasArrayParam = true;
      }
      const itemVar = new PythonIdentifier(paramName);
      if (indexName) {
        const indexVar = new PythonIdentifier(indexName);
        return {
          itemVar,
          substitutions: hasArrayParam ? [itemVar, indexVar, array] : [itemVar, indexVar],
          loopTarget: new PythonTuple([indexVar, itemVar]),
          iterable: new PythonCall(new PythonIdentifier('enumerate'), [array])
        };
      }
      return { itemVar, substitutions: [itemVar], loopTarget: itemVar, iterable: array };
    }

    transformArrayMap(node) {
      const array = this.transformExpression(node.array);
      const callback = node.callback;
      const bound = this._bindArrayCallbackIndex(array, callback);
      const expr = this.transformCallbackExpr(callback, bound.substitutions);
      return new PythonListComprehension(expr, bound.loopTarget, bound.iterable);
    }

    /**
     * Transform ArrayFilter to list comprehension with condition
     * Python: [x for x in array if condition(x)]
     */
    transformArrayFilter(node) {
      const array = this.transformExpression(node.array);
      const callback = node.callback;
      const bound = this._bindArrayCallbackIndex(array, callback);
      const condition = this.transformCallbackExpr(callback, bound.substitutions);
      return new PythonListComprehension(bound.itemVar, bound.loopTarget, bound.iterable, condition);
    }

    /**
     * Transform ArraySome to any()
     * Python: any(callback(x) for x in array)
     */
    transformArraySome(node) {
      const array = this.transformExpression(node.array);
      const callback = node.callback;
      const bound = this._bindArrayCallbackIndex(array, callback);
      const condition = this.transformCallbackExpr(callback, bound.substitutions);
      const genExpr = new PythonGeneratorExpression(condition, bound.loopTarget, bound.iterable);
      return new PythonCall(new PythonIdentifier('any'), [genExpr]);
    }

    /**
     * Transform ArrayEvery to all()
     * Python: all(callback(x) for x in array)
     */
    transformArrayEvery(node) {
      const array = this.transformExpression(node.array);
      const callback = node.callback;
      const bound = this._bindArrayCallbackIndex(array, callback);
      const condition = this.transformCallbackExpr(callback, bound.substitutions);
      const genExpr = new PythonGeneratorExpression(condition, bound.loopTarget, bound.iterable);
      return new PythonCall(new PythonIdentifier('all'), [genExpr]);
    }

    /**
     * Transform ArrayFind to next() with generator
     * Python: next((x for x in array if condition(x)), None)
     */
    transformArrayFind(node) {
      const array = this.transformExpression(node.array);
      const callback = node.callback;

      // Extract the actual callback parameter name instead of hardcoding _x
      let paramName = '_x';
      if (callback && callback.params && callback.params.length > 0) {
        const param = callback.params[0];
        paramName = param.name || param.value || '_x';
        paramName = toSnakeCase(paramName);
      }
      const itemVar = new PythonIdentifier(paramName);
      const condition = this.transformCallbackExpr(callback, [itemVar]);

      const genExpr = new PythonGeneratorExpression(itemVar, itemVar, array, condition);
      return new PythonCall(new PythonIdentifier('next'), [genExpr, PythonLiteral.None()]);
    }

    /**
     * Transform ArrayFindIndex to next() with enumerate
     * Python: next((i for i, x in enumerate(array) if condition(x)), -1)
     */
    transformArrayFindIndex(node) {
      const array = this.transformExpression(node.array);
      const callback = node.callback;

      const indexVar = new PythonIdentifier('_i');
      // Extract the actual callback parameter name instead of hardcoding _x
      let paramName = '_x';
      if (callback && callback.params && callback.params.length > 0) {
        const param = callback.params[0];
        paramName = param.name || param.value || '_x';
        paramName = toSnakeCase(paramName);
      }
      const itemVar = new PythonIdentifier(paramName);
      const condition = this.transformCallbackExpr(callback, [itemVar, indexVar]);

      const enumCall = new PythonCall(new PythonIdentifier('enumerate'), [array]);
      const tupleTarget = new PythonTuple([indexVar, itemVar]);
      const genExpr = new PythonGeneratorExpression(indexVar, tupleTarget, enumCall, condition);
      return new PythonCall(new PythonIdentifier('next'), [genExpr, PythonLiteral.Int(-1)]);
    }

    /**
     * Transform ArrayReduce to functools.reduce
     * Python: functools.reduce(lambda acc, x: ..., array, initial)
     */
    transformArrayReduce(node) {
      this.imports.add('functools');
      const array = this.transformExpression(node.array);
      const callback = node.callback;
      // The shared type-aware-transpiler.js IL producer names this field
      // `initialValue` (see its 'ArrayReduce' case) - `node.initial` is never
      // populated, so `.reduce(fn, 0)`'s seed value silently got dropped,
      // making functools.reduce seed itself from the array's own first
      // element instead (wrong type when that's a string, e.g.
      // shannon-fano.js's symbol-frequency reduce: "can only concatenate str
      // (not int) to str").
      const initialNode = node.initialValue !== undefined ? node.initialValue : node.initial;
      const initial = initialNode ? this.transformExpression(initialNode) : null;

      // Extract the actual callback parameter names
      let accParamName = '_acc';
      let itemParamName = '_x';
      if (callback && callback.params && callback.params.length > 0) {
        const accParam = callback.params[0];
        accParamName = accParam.name || accParam.value || '_acc';
        accParamName = toSnakeCase(accParamName);
        if (callback.params.length > 1) {
          const itemParam = callback.params[1];
          itemParamName = itemParam.name || itemParam.value || '_x';
          itemParamName = toSnakeCase(itemParamName);
        }
      }

      const accVar = new PythonIdentifier(accParamName);
      const itemVar = new PythonIdentifier(itemParamName);
      const lambdaBody = this.transformCallbackExpr(callback, [accVar, itemVar]);

      const lambda = new PythonLambda([accVar, itemVar], lambdaBody);

      const args = [lambda, array];
      if (initial) args.push(initial);

      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('functools'), 'reduce'),
        args
      );
    }

    // ========================[ STRING OPERATIONS ]========================

    /**
     * Transform StringReplace to safe_replace() helper function
     * Python: safe_replace(string, search, replacement)
     * Uses helper function that handles None values like JavaScript
     */
    transformStringReplace(node) {
      const string = this.transformExpression(node.string || node.object);
      const rawSearch = node.searchValue || node.search || node.pattern;
      const search = rawSearch
        ? this.transformExpression(rawSearch)
        : PythonLiteral.Str('');
      const rawReplacement = node.replaceValue !== undefined ? node.replaceValue : node.replacement;
      const replacement = rawReplacement !== undefined && rawReplacement !== null
        ? this.transformExpression(rawReplacement)
        : PythonLiteral.Str('');
      const isGlobal = node.method === 'replaceAll' ||
        !!(rawSearch && rawSearch.regex && rawSearch.regex.flags && rawSearch.regex.flags.includes('g'));

      // Use safe_replace helper to handle None values
      return new PythonCall(new PythonIdentifier('safe_replace'), [string, search, replacement, PythonLiteral.Bool(isGlobal)]);
    }

    /**
     * Transform StringRepeat to string * count
     * Python: string * count
     */
    transformStringRepeat(node) {
      const string = this.transformExpression(node.string || node.object);
      const count = this.transformExpression(node.count);
      return new PythonBinaryExpression(string, '*', count);
    }

    /**
     * Transform StringIndexOf to str.find()
     * Python: string.find(search) - returns -1 if not found
     */
    transformStringIndexOf(node) {
      // The parser (type-aware-transpiler.js _transformStringMethod) emits
      // this IL node with `searchValue`/`fromIndex` fields (see its
      // 'indexOf'/'lastIndexOf' case) - not `search`/`start`. Reading the
      // wrong field names left `search` undefined, which transformExpression
      // silently drops, producing a bare `.find()` call with no arguments
      // (a Python TypeError at runtime) instead of `.find(x)`.
      const string = this.transformExpression(node.string || node.object);
      const searchNode = node.searchValue !== undefined ? node.searchValue : node.search;
      const search = this.transformExpression(searchNode);
      const args = [search];
      const fromIndexNode = node.fromIndex !== undefined ? node.fromIndex : node.start;
      if (fromIndexNode) args.push(this.transformExpression(fromIndexNode));
      // str.rfind() mirrors JS's lastIndexOf() (search backward from the end);
      // str.find() mirrors indexOf() (search forward from the start/fromIndex).
      const pyMethod = node.method === 'lastIndexOf' ? 'rfind' : 'find';
      return new PythonCall(new PythonMemberAccess(string, pyMethod), args);
    }

    /**
     * Transform StringSplit to str.split()
     * Python: string.split(separator)
     */
    transformStringSplit(node) {
      const string = this.transformExpression(node.string || node.object);
      const separatorNode = node.separator;
      const separator = separatorNode ? this.transformExpression(separatorNode) : null;
      // `str.split(/regex/)` (e.g. morse.js's `upperData.split(/\s+/)`) -
      // a regex literal becomes a compiled re.Pattern (see transformLiteral),
      // and Python's str.split() rejects any non-str/None separator
      // ("must be str or None, not re.Pattern"). re.Pattern objects have
      // their own .split(string) method that DOES accept a plain string,
      // so just swap operands - `pattern.split(string)` - instead of
      // switching to the module-level re.split(pattern, string) form.
      if (separatorNode && separatorNode.type === 'Literal' && separatorNode.regex) {
        return new PythonCall(new PythonMemberAccess(separator, 'split'), [string]);
      }
      // `str.split('')` - JS's idiom for "explode a string into an array of
      // its individual characters" (e.g. classical/foursquare.js's
      // `keyword...split('').filter(...)` deduplication) - Python's
      // str.split('') isn't the equivalent "split between every
      // character"; it unconditionally raises ValueError("empty
      // separator") for ANY input, since Python has no such split mode.
      // list(string) is the direct Python equivalent (a list of
      // single-character strings, same as JS's split('') result) and,
      // unlike the .split(other-separator) cases below, needs no
      // arguments at all. Previously this fell through to the generic
      // `string.split("")` call unconditionally, so JS code relying on
      // this extremely common idiom crashed every time (often silently
      // swallowed by a surrounding try/catch elsewhere, corrupting later
      // results instead of surfacing as a visible error).
      if (separatorNode && separatorNode.type === 'Literal' && separatorNode.value === '') {
        return new PythonCall(new PythonIdentifier('list'), [string]);
      }
      const args = separator ? [separator] : [];
      return new PythonCall(new PythonMemberAccess(string, 'split'), args);
    }

    /**
     * Transform StringSubstring to string slicing
     * Python: string[start:end]
     */
    transformStringSubstring(node) {
      const string = this.transformExpression(node.string || node.object);
      const start = node.start ? this.transformExpression(node.start) : null;
      // type-aware-transpiler.js's StringSubstring IL node deliberately keeps
      // substr()'s 2nd argument (a character COUNT) out of `end` (an end
      // INDEX, substring()/slice()'s semantics) in a separate `length` field
      // - see its own comment on why conflating them corrupts every
      // multi-char substr() call. This was still happening here though:
      // `node.length` was never read, so `str.substr(i, 8)` (start=i,
      // end=null, length=8) fell straight to the `!node.end` branch below and
      // produced `string[i:]` - a slice to the end of the string instead of
      // just 8 characters (e.g. compression/elias-delta.js's byte-packing
      // loop then fed that whole runaway bit-string into int(byte, 2),
      // producing values far outside 0-255 and blowing up the later chr()
      // call). Compute the actual end index (start + length) when present.
      let end;
      if (node.length) {
        const len = this.transformExpression(node.length);
        end = new PythonBinaryExpression(start || PythonLiteral.Int(0), '+', len);
      } else {
        end = node.end ? this.transformExpression(node.end) : null;
      }
      return new PythonSubscript(string, new PythonSlice(start, end));
    }

    /**
     * Transform StringCharAt to string indexing
     * Python: string[index]
     */
    transformStringCharAt(node) {
      const string = this.transformExpression(node.string || node.object);
      // node.index may be an UpdateExpression (e.g. str.charAt(i++)) which Python
      // cannot express inline inside a subscript - hoist the side effect out.
      const index = this.transformSideEffectFreeValue(node.index);
      return new PythonSubscript(string, index);
    }

    /**
     * Transform StringCharCodeAt to ord(string[index])
     * Python: ord(string[index])
     */
    transformStringCharCodeAt(node) {
      const string = this.transformExpression(node.string || node.object);
      // node.index may be an UpdateExpression (e.g. str.charCodeAt(i++)) which Python
      // cannot express inline inside a subscript - hoist the side effect out.
      const index = this.transformSideEffectFreeValue(node.index);
      const char = new PythonSubscript(string, index);
      return new PythonCall(new PythonIdentifier('ord'), [char]);
    }

    /**
     * Transform StringToUpperCase to str.upper()
     */
    transformStringToUpperCase(node) {
      const string = this.transformExpression(node.string || node.object || node.argument);
      return new PythonCall(new PythonMemberAccess(string, 'upper'), []);
    }

    /**
     * Transform StringToLowerCase to str.lower()
     */
    transformStringToLowerCase(node) {
      const string = this.transformExpression(node.string || node.object || node.argument);
      return new PythonCall(new PythonMemberAccess(string, 'lower'), []);
    }

    /**
     * Transform StringTrim to str.strip()
     */
    transformStringTrim(node) {
      const string = this.transformExpression(node.string || node.object || node.argument);
      return new PythonCall(new PythonMemberAccess(string, 'strip'), []);
    }

    /**
     * Transform StringStartsWith to str.startswith()
     */
    transformStringStartsWith(node) {
      const string = this.transformExpression(node.string || node.object);
      const prefix = this.transformExpression(node.prefix || node.search);
      return new PythonCall(new PythonMemberAccess(string, 'startswith'), [prefix]);
    }

    /**
     * Transform StringEndsWith to str.endswith()
     */
    transformStringEndsWith(node) {
      const string = this.transformExpression(node.string || node.object);
      const suffix = this.transformExpression(node.suffix || node.search);
      return new PythonCall(new PythonMemberAccess(string, 'endswith'), [suffix]);
    }

    /**
     * Transform StringIncludes to Python 'in' operator
     * JavaScript: str.includes(substr) → Python: substr in str
     */
    transformStringIncludes(node) {
      const string = this.transformExpression(node.string || node.object);
      const searchValue = this.transformExpression(node.searchValue || node.search || node.argument);
      // Python: searchValue in string
      return new PythonBinaryExpression(searchValue, 'in', string);
    }

    /**
     * Transform StringTransform for generic string methods
     * Maps to appropriate Python string method
     */
    transformStringTransform(node) {
      const string = this.transformExpression(node.string || node.object);
      const method = node.method;

      switch (method) {
        case 'toUpperCase':
          return new PythonCall(new PythonMemberAccess(string, 'upper'), []);
        case 'toLowerCase':
          return new PythonCall(new PythonMemberAccess(string, 'lower'), []);
        case 'trim':
          return new PythonCall(new PythonMemberAccess(string, 'strip'), []);
        case 'trimStart':
        case 'trimLeft':
          return new PythonCall(new PythonMemberAccess(string, 'lstrip'), []);
        case 'trimEnd':
        case 'trimRight':
          return new PythonCall(new PythonMemberAccess(string, 'rstrip'), []);
        case 'normalize':
          // Python: unicodedata.normalize('NFC', str)
          return new PythonCall(
            new PythonMemberAccess(new PythonIdentifier('unicodedata'), 'normalize'),
            [PythonLiteral.Str('NFC'), string]
          );
        default:
          // Fallback - try calling the method directly (snake_case)
          return new PythonCall(new PythonMemberAccess(string, toSnakeCase(method)), []);
      }
    }

    /**
     * Transform StringConcat to Python string concatenation
     * JavaScript: str.concat(a, b) → Python: str + a + b
     */
    transformStringConcat(node) {
      const string = this.transformExpression(node.string || node.object);
      const args = (node.arguments || []).map(a => this.transformExpression(a));

      if (args.length === 0)
        return string;

      // Chain concatenation with +
      let result = string;
      for (const arg of args)
        result = new PythonBinaryExpression(result, '+', arg);
      return result;
    }

    // ========================[ ADDITIONAL TRANSFORMS ]========================

    /**
     * Transform BigIntCast to int()
     * Python handles big integers natively.
     *
     * Route through the `_bigint()` helper (see its HELPER_STUBS doc
     * comment) rather than a bare `int(x)`: this is the IL node the shared
     * (out-of-bounds-for-this-plugin) type-aware-transpiler.js parser
     * produces for `BigInt(x)` whenever `x` isn't a literal it can convert
     * at parse time (e.g. `BigInt(keyHex)` where keyHex is a runtime-built
     * string) - the same non-compile-time-known-hex-string case the plain
     * CallExpression 'BigInt' funcName branch above already handles via
     * _bigint(), just reached through a different AST shape for the exact
     * same JS source pattern. A bare `int(x)` only handles decimal strings
     * and numbers; it raises ValueError on a "0x"/"0o"/"0b"-prefixed
     * runtime string, which is exactly what JS's real BigInt() constructor
     * accepts (auto-detecting the prefix) and _bigint() mirrors.
     */
    transformBigIntCast(node) {
      const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
      return new PythonCall(new PythonIdentifier('_bigint'), [value]);
    }

    /**
     * Transform TypedArraySet - copy elements from source to target at offset
     * Python: target[offset:offset+len(source)] = source
     */
    transformTypedArraySet(node) {
      const target = this.transformExpression(node.target || node.array);
      const source = this.transformExpression(node.source || node.values);
      const offset = node.offset ? this.transformExpression(node.offset) : PythonLiteral.Int(0);

      // target[offset:offset+len(source)] = source
      const sourceLen = new PythonCall(new PythonIdentifier('len'), [source]);
      const endIndex = new PythonBinaryExpression(offset, '+', sourceLen);
      const slice = new PythonSlice(offset, endIndex);

      return new PythonAssignment(
        new PythonSubscript(target, slice),
        source
      );
    }

    /**
     * True when `node` (a raw/IL AST expression node, pre-transform) is
     * shaped like something that produces an array/byte-buffer value -
     * used to catch a gap in type-aware-transpiler.js's TypedArraySet-vs-
     * MapSet `.set()` disambiguation (see transformMapSet's doc comment).
     */
    _looksLikeArrayShapedNode(node) {
      if (!node) return false;
      const t = node.ilNodeType || node.type;
      if (['TypedArrayCreation', 'ArrayExpression', 'ArrayLiteral', 'TypedArraySubarray',
           'ArraySlice', 'TypedArraySlice', 'UnpackBytes', 'PackBytes', 'ArrayConcat'].includes(t)) return true;
      const rt = node.resultType;
      if (typeof rt === 'string' && (rt.endsWith('[]') || /^(Ui|I)nt(8|16|32)Array$/.test(rt) || rt === 'Uint8Array')) return true;
      return false;
    }

    /**
     * Transform MapSet - dict/map assignment
     * map.set(key, value) -> map[key] = value
     *
     * type-aware-transpiler.js's own `.set()` disambiguation (see its 'set'
     * case) already tries to route a TypedArray's `.set(source, offset)`
     * call away from this MapSet path, but its isFirstArgArray whitelist
     * doesn't include a freshly-constructed typed array
     * (ilNodeType 'TypedArrayCreation') as a first argument - e.g.
     * deoxys-ii.js's `tweak.set(new Uint8Array(counter.buffer), 8)` (copy a
     * byte view into `tweak` at offset 8) falls through to here instead,
     * producing `tweak[<byte buffer>] = 8` - nothing here is ever a real
     * JS Map, so that TypeErrors immediately trying to use a byte buffer as
     * a bytearray subscript. Recognize the same "first arg is array-
     * shaped, second is a plain offset/scalar" shape MapSet's own
     * IL-node counterpart already gates TypedArraySet on, and reroute
     * through the real TypedArraySet transform instead of emitting a
     * dict-style assignment.
     */
    transformMapSet(node) {
      if (this._looksLikeArrayShapedNode(node.key) && !this._looksLikeArrayShapedNode(node.value)) {
        return this.transformTypedArraySet({ target: node.map, source: node.key, offset: node.value });
      }

      const map = this.transformExpression(node.map);
      const key = this.transformExpression(node.key);
      const value = this.transformExpression(node.value);

      // map[key] = value
      return new PythonAssignment(
        new PythonSubscript(map, key),
        value
      );
    }

    /**
     * Transform TypedArraySubarray - get a LIVE view of array
     * array.subarray(begin, end) -> JSUint8ArraySubarray(array, begin, end)
     *
     * JS's TypedArray#subarray() returns a view aliasing the same backing
     * storage - writes through the returned view mutate the original array
     * (e.g. block/crypton.js, aead/orange.js's
     * `orangeBlockRotate(KS.subarray(0, 16), state.subarray(0, 16))` where
     * the callee writes into its `out` parameter expecting those writes to
     * land back in KS). A plain Python slice (`array[begin:end]`) always
     * copies, silently dropping every such write - the previous behavior
     * here - so this only ever exists as a real TypedArray method (unlike
     * subarray-adjacent Array/string slice ops which do want a copy),
     * meaning the live-view class is safe unconditionally.
     */
    transformTypedArraySubarray(node) {
      const array = this.transformExpression(node.array);
      const begin = node.begin ? this.transformExpression(node.begin) : PythonLiteral.Int(0);
      const end = node.end ? this.transformExpression(node.end) : PythonLiteral.None();
      return new PythonCall(new PythonIdentifier('JSUint8ArraySubarray'), [array, begin, end]);
    }

    /**
     * Transform Sqrt to math.sqrt()
     */
    transformSqrt(node) {
      this.imports.add('math');
      const argument = this.transformExpression(node.argument || node.arguments?.[0]);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'sqrt'),
        [argument]
      );
    }

    /**
     * Transform Power to Python exponentiation
     * Python: base ** exponent
     */
    transformPower(node) {
      const base = this.transformExpression(node.base);
      const exponent = this.transformExpression(node.exponent);
      return new PythonBinaryExpression(base, '**', exponent);
    }

    /**
     * Transform Log2 to math.log2()
     */
    transformLog2(node) {
      this.imports.add('math');
      const argument = this.transformExpression(node.argument);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'log2'),
        [argument]
      );
    }

    /**
     * Transform Sin to math.sin(x)
     */
    transformSin(node) {
      this.imports.add('math');
      // IL AST uses a singular `argument` field for these (see
      // type-aware-transpiler.js's Math.* single-arg node builders), not
      // `arguments`/`value` - falling straight to those (as this used to)
      // finds nothing and silently drops the operand, e.g. Math.exp(-x)
      // emitting `math.exp()` with zero args (TypeError at runtime).
      const argument = this.transformExpression(node.argument || node.arguments?.[0] || node.value);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'sin'),
        [argument]
      );
    }

    /**
     * Transform Cos to math.cos(x)
     */
    transformCos(node) {
      this.imports.add('math');
      // IL AST uses a singular `argument` field for these (see
      // type-aware-transpiler.js's Math.* single-arg node builders), not
      // `arguments`/`value` - falling straight to those (as this used to)
      // finds nothing and silently drops the operand, e.g. Math.exp(-x)
      // emitting `math.exp()` with zero args (TypeError at runtime).
      const argument = this.transformExpression(node.argument || node.arguments?.[0] || node.value);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'cos'),
        [argument]
      );
    }

    /**
     * Transform Tan to math.tan(x)
     */
    transformTan(node) {
      this.imports.add('math');
      // IL AST uses a singular `argument` field for these (see
      // type-aware-transpiler.js's Math.* single-arg node builders), not
      // `arguments`/`value` - falling straight to those (as this used to)
      // finds nothing and silently drops the operand, e.g. Math.exp(-x)
      // emitting `math.exp()` with zero args (TypeError at runtime).
      const argument = this.transformExpression(node.argument || node.arguments?.[0] || node.value);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'tan'),
        [argument]
      );
    }

    /**
     * Transform Asin to math.asin(x)
     */
    transformAsin(node) {
      this.imports.add('math');
      // IL AST uses a singular `argument` field for these (see
      // type-aware-transpiler.js's Math.* single-arg node builders), not
      // `arguments`/`value` - falling straight to those (as this used to)
      // finds nothing and silently drops the operand, e.g. Math.exp(-x)
      // emitting `math.exp()` with zero args (TypeError at runtime).
      const argument = this.transformExpression(node.argument || node.arguments?.[0] || node.value);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'asin'),
        [argument]
      );
    }

    /**
     * Transform Acos to math.acos(x)
     */
    transformAcos(node) {
      this.imports.add('math');
      // IL AST uses a singular `argument` field for these (see
      // type-aware-transpiler.js's Math.* single-arg node builders), not
      // `arguments`/`value` - falling straight to those (as this used to)
      // finds nothing and silently drops the operand, e.g. Math.exp(-x)
      // emitting `math.exp()` with zero args (TypeError at runtime).
      const argument = this.transformExpression(node.argument || node.arguments?.[0] || node.value);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'acos'),
        [argument]
      );
    }

    /**
     * Transform Atan to math.atan(x)
     */
    transformAtan(node) {
      this.imports.add('math');
      // IL AST uses a singular `argument` field for these (see
      // type-aware-transpiler.js's Math.* single-arg node builders), not
      // `arguments`/`value` - falling straight to those (as this used to)
      // finds nothing and silently drops the operand, e.g. Math.exp(-x)
      // emitting `math.exp()` with zero args (TypeError at runtime).
      const argument = this.transformExpression(node.argument || node.arguments?.[0] || node.value);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'atan'),
        [argument]
      );
    }

    /**
     * Transform Atan2 to math.atan2(y, x)
     */
    transformAtan2(node) {
      this.imports.add('math');
      const y = this.transformExpression(node.arguments?.[0] || node.y);
      const x = this.transformExpression(node.arguments?.[1] || node.x);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'atan2'),
        [y, x]
      );
    }

    /**
     * Transform Sinh to math.sinh(x)
     */
    transformSinh(node) {
      this.imports.add('math');
      // IL AST uses a singular `argument` field for these (see
      // type-aware-transpiler.js's Math.* single-arg node builders), not
      // `arguments`/`value` - falling straight to those (as this used to)
      // finds nothing and silently drops the operand, e.g. Math.exp(-x)
      // emitting `math.exp()` with zero args (TypeError at runtime).
      const argument = this.transformExpression(node.argument || node.arguments?.[0] || node.value);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'sinh'),
        [argument]
      );
    }

    /**
     * Transform Cosh to math.cosh(x)
     */
    transformCosh(node) {
      this.imports.add('math');
      // IL AST uses a singular `argument` field for these (see
      // type-aware-transpiler.js's Math.* single-arg node builders), not
      // `arguments`/`value` - falling straight to those (as this used to)
      // finds nothing and silently drops the operand, e.g. Math.exp(-x)
      // emitting `math.exp()` with zero args (TypeError at runtime).
      const argument = this.transformExpression(node.argument || node.arguments?.[0] || node.value);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'cosh'),
        [argument]
      );
    }

    /**
     * Transform Tanh to math.tanh(x)
     */
    transformTanh(node) {
      this.imports.add('math');
      // IL AST uses a singular `argument` field for these (see
      // type-aware-transpiler.js's Math.* single-arg node builders), not
      // `arguments`/`value` - falling straight to those (as this used to)
      // finds nothing and silently drops the operand, e.g. Math.exp(-x)
      // emitting `math.exp()` with zero args (TypeError at runtime).
      const argument = this.transformExpression(node.argument || node.arguments?.[0] || node.value);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'tanh'),
        [argument]
      );
    }

    /**
     * Transform Exp to math.exp(x)
     */
    transformExp(node) {
      this.imports.add('math');
      // IL AST uses a singular `argument` field for these (see
      // type-aware-transpiler.js's Math.* single-arg node builders), not
      // `arguments`/`value` - falling straight to those (as this used to)
      // finds nothing and silently drops the operand, e.g. Math.exp(-x)
      // emitting `math.exp()` with zero args (TypeError at runtime).
      const argument = this.transformExpression(node.argument || node.arguments?.[0] || node.value);
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'exp'),
        [argument]
      );
    }

    /**
     * Transform Cbrt to pow(x, 1.0 / 3.0)
     * Python 3.11+ has math.cbrt but pow is safer for compatibility
     */
    transformCbrt(node) {
      // IL AST uses a singular `argument` field for these (see
      // type-aware-transpiler.js's Math.* single-arg node builders), not
      // `arguments`/`value` - falling straight to those (as this used to)
      // finds nothing and silently drops the operand, e.g. Math.exp(-x)
      // emitting `math.exp()` with zero args (TypeError at runtime).
      const argument = this.transformExpression(node.argument || node.arguments?.[0] || node.value);
      return new PythonCall(
        new PythonIdentifier('pow'),
        [argument, new PythonBinaryExpression(PythonLiteral.Float(1.0), '/', PythonLiteral.Float(3.0))]
      );
    }

    /**
     * Transform Hypot to math.hypot(a, b, ...)
     */
    transformHypot(node) {
      this.imports.add('math');
      const args = (node.arguments || []).map(a => this.transformExpression(a));
      return new PythonCall(
        new PythonMemberAccess(new PythonIdentifier('math'), 'hypot'),
        args
      );
    }

    /**
     * Transform Fround to float(x)
     * Python floats are already IEEE 754 double precision; closest approximation
     */
    transformFround(node) {
      // IL AST uses a singular `argument` field for these (see
      // type-aware-transpiler.js's Math.* single-arg node builders), not
      // `arguments`/`value` - falling straight to those (as this used to)
      // finds nothing and silently drops the operand, e.g. Math.exp(-x)
      // emitting `math.exp()` with zero args (TypeError at runtime).
      const argument = this.transformExpression(node.argument || node.arguments?.[0] || node.value);
      return new PythonCall(new PythonIdentifier('float'), [argument]);
    }

    /**
     * Transform MathConstant to Python math module constants or expressions
     * Maps: PI→math.pi, E→math.e, LN2→math.log(2), LN10→math.log(10),
     *        LOG2E→math.log2(math.e), LOG10E→math.log10(math.e),
     *        SQRT2→math.sqrt(2), SQRT1_2→math.sqrt(0.5)
     */
    transformMathConstant(node) {
      this.imports.add('math');
      const mathId = new PythonIdentifier('math');
      switch (node.name) {
        case 'PI':
          return new PythonMemberAccess(mathId, 'pi');
        case 'E':
          return new PythonMemberAccess(mathId, 'e');
        case 'LN2':
          return new PythonCall(
            new PythonMemberAccess(mathId, 'log'),
            [PythonLiteral.Int(2)]
          );
        case 'LN10':
          return new PythonCall(
            new PythonMemberAccess(mathId, 'log'),
            [PythonLiteral.Int(10)]
          );
        case 'LOG2E':
          return new PythonCall(
            new PythonMemberAccess(mathId, 'log2'),
            [new PythonMemberAccess(mathId, 'e')]
          );
        case 'LOG10E':
          return new PythonCall(
            new PythonMemberAccess(mathId, 'log10'),
            [new PythonMemberAccess(mathId, 'e')]
          );
        case 'SQRT2':
          return new PythonCall(
            new PythonMemberAccess(mathId, 'sqrt'),
            [PythonLiteral.Int(2)]
          );
        case 'SQRT1_2':
          return new PythonCall(
            new PythonMemberAccess(mathId, 'sqrt'),
            [PythonLiteral.Float(0.5)]
          );
        default:
          return new PythonMemberAccess(mathId, node.name.toLowerCase());
      }
    }

    /**
     * Transform NumberConstant to Python equivalents
     * Maps: MAX_SAFE_INTEGER→2**53-1, MIN_SAFE_INTEGER→-(2**53-1),
     *        MAX_VALUE→sys.float_info.max, MIN_VALUE→sys.float_info.min,
     *        EPSILON→sys.float_info.epsilon, POSITIVE_INFINITY→math.inf,
     *        NEGATIVE_INFINITY→-math.inf, NaN→math.nan
     */
    transformNumberConstant(node) {
      switch (node.name) {
        case 'MAX_SAFE_INTEGER':
          return new PythonBinaryExpression(
            new PythonBinaryExpression(PythonLiteral.Int(2), '**', PythonLiteral.Int(53)),
            '-',
            PythonLiteral.Int(1)
          );
        case 'MIN_SAFE_INTEGER':
          return new PythonUnaryExpression('-', new PythonBinaryExpression(
            new PythonBinaryExpression(PythonLiteral.Int(2), '**', PythonLiteral.Int(53)),
            '-',
            PythonLiteral.Int(1)
          ));
        case 'MAX_VALUE':
          this.imports.add('sys');
          return new PythonMemberAccess(
            new PythonMemberAccess(new PythonIdentifier('sys'), 'float_info'),
            'max'
          );
        case 'MIN_VALUE':
          this.imports.add('sys');
          return new PythonMemberAccess(
            new PythonMemberAccess(new PythonIdentifier('sys'), 'float_info'),
            'min'
          );
        case 'EPSILON':
          this.imports.add('sys');
          return new PythonMemberAccess(
            new PythonMemberAccess(new PythonIdentifier('sys'), 'float_info'),
            'epsilon'
          );
        case 'POSITIVE_INFINITY':
          this.imports.add('math');
          return new PythonMemberAccess(new PythonIdentifier('math'), 'inf');
        case 'NEGATIVE_INFINITY':
          this.imports.add('math');
          return new PythonUnaryExpression('-', new PythonMemberAccess(new PythonIdentifier('math'), 'inf'));
        case 'NaN':
          this.imports.add('math');
          return new PythonMemberAccess(new PythonIdentifier('math'), 'nan');
        default:
          return PythonLiteral.Float(node.value);
      }
    }

    /**
     * Transform InstanceOfCheck to isinstance(value, ClassName)
     */
    transformInstanceOfCheck(node) {
      const value = this.transformExpression(node.value);
      // `x instanceof Uint8Array` etc.: the generic Identifier transform
      // below (this.transformExpression(node.className)) snake_cases
      // whatever name it's given (toSnakeCase), same as any other bare
      // identifier - fine for a real user-defined class (PascalCase stays
      // PascalCase - toSnakeCase leaves single all-caps-initial runs alone),
      // but a built-in JS global constructor doesn't exist as a Python name
      // at all: `Uint8Array` becomes `uint8_array`, a NameError the first
      // time the check actually runs (isinstance(x, uint8_array)) since
      // nothing defines that name - this only surfaces at runtime, not
      // TRANSPILE FAIL, because building the isinstance(...) call itself
      // never errors. Map these to whatever Python type(s) this transpiler
      // actually represents that JS shape as elsewhere (see the typed-array
      // constructor/`.from()` handling above).
      const BYTES_LIKE = new PythonTuple([new PythonIdentifier('bytes'), new PythonIdentifier('bytearray'), new PythonIdentifier('list')]);
      const BUILTIN_INSTANCEOF_MAP = {
        'Array': new PythonIdentifier('list'),
        'Uint8Array': BYTES_LIKE, 'Int8Array': BYTES_LIKE, 'Uint8ClampedArray': BYTES_LIKE,
        'Uint16Array': new PythonIdentifier('list'), 'Int16Array': new PythonIdentifier('list'),
        'Uint32Array': new PythonIdentifier('list'), 'Int32Array': new PythonIdentifier('list'),
        'Float32Array': new PythonIdentifier('list'), 'Float64Array': new PythonIdentifier('list'),
        'BigUint64Array': new PythonIdentifier('list'), 'BigInt64Array': new PythonIdentifier('list'),
        'ArrayBuffer': new PythonTuple([new PythonIdentifier('bytes'), new PythonIdentifier('bytearray')]),
        'String': new PythonIdentifier('str'),
        'Number': new PythonTuple([new PythonIdentifier('int'), new PythonIdentifier('float')]),
        'Boolean': new PythonIdentifier('bool'),
        'Error': new PythonIdentifier('Exception'),
        'Object': new PythonIdentifier('dict'),
      };
      const rawClassName = node.className?.type === 'Identifier' ? node.className.name : null;
      const className = (rawClassName && BUILTIN_INSTANCEOF_MAP[rawClassName])
        ? BUILTIN_INSTANCEOF_MAP[rawClassName]
        : this.transformExpression(node.className);
      return new PythonCall(new PythonIdentifier('isinstance'), [value, className]);
    }

    /**
     * Transform ArraySort to _js_sort() - JS `arr.sort(cmp)` sorts `arr` IN
     * PLACE and returns that same reference; Python's `sorted()` (used
     * here previously) only ever returns a new list, leaving the original
     * variable unsorted for the extremely common bare-statement idiom
     * `arr.sort(cmp);` (e.g. classical/columnar.js's
     * `columns.sort((a, b) => ...)`, where only the mutation is used - see
     * the _js_sort HELPER_STUBS doc comment for the full reasoning).
     */
    transformArraySort(node) {
      const array = this.transformExpression(node.array);

      if (node.compareFn) {
        // If there's a comparison function, we need to convert it to a key function
        // JavaScript: arr.sort((a, b) => a - b)
        // For custom sorts, we need functools.cmp_to_key
        this.imports.add('functools');
        let compareFunc;
        // A block-bodied comparator (e.g. classical/bazeries.js's
        // `keyArray.sort((a, b) => { if (a.char < b.char) return -1; if
        // (a.char > b.char) return 1; return a.index - b.index; })`, a
        // multi-branch stable tie-break comparator) can't become a plain
        // Python `lambda` - lambdas only support a single expression.
        // `this.transformExpression(node.compareFn)` (used here
        // previously) falls to the generic arrow-function path for a
        // block body, which keeps only the LAST statement's expression and
        // silently drops every earlier statement (here, both `if`
        // early-returns) - corrupting the sort into an entirely different
        // (wrong) ordering instead of raising. Hoist it into a real named
        // function via transformArrowToFunction (the same mechanism used
        // for block-bodied arrows stored as values elsewhere) so every
        // statement - and both early returns - survive intact.
        if (node.compareFn.body && node.compareFn.body.type === 'BlockStatement') {
          this._callbackHelperCounter = (this._callbackHelperCounter || 0) + 1;
          const fnName = `_cmp_${this._callbackHelperCounter}`;
          const funcDef = this.transformArrowToFunction(fnName, node.compareFn);
          if (!this.pendingPreStatements) this.pendingPreStatements = [];
          this.pendingPreStatements.push(funcDef);
          compareFunc = new PythonIdentifier(fnName);
        } else {
          compareFunc = this.transformExpression(node.compareFn);
        }
        return new PythonCall(
          new PythonIdentifier('_js_sort'),
          [array, new PythonCall(
            new PythonMemberAccess(new PythonIdentifier('functools'), 'cmp_to_key'),
            [compareFunc]
          )]
        );
      }

      // Default sort
      return new PythonCall(new PythonIdentifier('_js_sort'), [array]);
    }

    /**
     * Transform ArraySplice to Python slice assignment
     * JavaScript: arr.splice(start, deleteCount, ...items)
     * Python: arr[start:start+deleteCount] = items or del arr[start:start+deleteCount]
     */
    transformArraySplice(node) {
      const array = this.transformExpression(node.array);
      const start = this.transformExpression(node.start);
      const deleteCount = node.deleteCount ? this.transformExpression(node.deleteCount) : null;
      const items = node.items ? node.items.map(item => this.transformExpression(item)) : [];

      // For now, return a helper function call
      // Python: splice_array(arr, start, deleteCount, *items)
      const args = [array, start];
      if (deleteCount)
        args.push(deleteCount);
      else
        args.push(PythonLiteral.Int(0));

      if (items.length > 0)
        args.push(new PythonList(items));
      else
        args.push(new PythonList([]));

      return new PythonCall(new PythonIdentifier('splice_array'), args);
    }

    /**
     * Transform SetCreation to Python set()
     * JavaScript: new Set() or new Set(iterable)
     */
    transformSetCreation(node) {
      if (node.values) {
        const values = this.transformExpression(node.values);
        return new PythonCall(new PythonIdentifier('set'), [values]);
      }
      return new PythonCall(new PythonIdentifier('set'), []);
    }
  }

  // Export
  const exports = { PythonTransformer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.PythonTransformer = PythonTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
