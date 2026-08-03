/**
 * PerlTransformer.js - JavaScript AST to Perl AST Transformer
 * Converts type-annotated JavaScript AST to Perl AST
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Perl AST -> Perl Emitter -> Perl Source
 */

(function(global) {
  'use strict';

  // Load dependencies
  let PerlAST;
  if (typeof require !== 'undefined') {
    PerlAST = require('./PerlAST.js');
  } else if (global.PerlAST) {
    PerlAST = global.PerlAST;
  }

  const {
    PerlType, PerlModule, PerlUse, PerlPackage, PerlClass, PerlField,
    PerlSub, PerlParameter, PerlBlock, PerlVarDeclaration, PerlExpressionStatement,
    PerlReturn, PerlIf, PerlFor, PerlWhile, PerlLast, PerlNext, PerlRedo,
    PerlDie, PerlTry, PerlGiven, PerlWhen, PerlLiteral, PerlIdentifier,
    PerlBinaryExpression, PerlUnaryExpression, PerlAssignment, PerlMemberAccess,
    PerlSubscript, PerlCall, PerlArray, PerlHash, PerlAnonSub, PerlBless,
    PerlConditional, PerlList, PerlQw, PerlRegex, PerlStringInterpolation,
    PerlPOD, PerlComment, PerlGrouped, PerlArraySlice, PerlRawCode
  } = PerlAST;

  /**
   * Maps JavaScript/JSDoc types to Perl types (for comments or Moose)
   */
  const TYPE_MAP = {
    // Numeric types
    'uint8': 'Int', 'byte': 'Int',
    'uint16': 'Int', 'ushort': 'Int', 'word': 'Int',
    'uint32': 'Int', 'uint': 'Int', 'dword': 'Int',
    'uint64': 'Int', 'ulong': 'Int', 'qword': 'Int',
    'int8': 'Int', 'sbyte': 'Int',
    'int16': 'Int', 'short': 'Int',
    'int32': 'Int', 'int': 'Int',
    'int64': 'Int', 'long': 'Int',
    'float': 'Num', 'float32': 'Num',
    'double': 'Num', 'float64': 'Num',
    'number': 'Num',
    // Other types
    'boolean': 'Bool', 'bool': 'Bool',
    'string': 'Str', 'String': 'Str',
    'void': 'void',
    'object': 'HashRef',
    'Array': 'ArrayRef'
  };

  /**
   * JavaScript AST to Perl AST Transformer
   *
   * Supported Options:
   * - indent: string - Indentation string (default: '    ')
   * - lineEnding: string - Line ending character (default: '\n')
   * - useStrict: boolean - Add 'use strict'. Default: true
   * - useWarnings: boolean - Add 'use warnings'. Default: true
   * - addSignatures: boolean - Use modern Perl signatures. Default: true
   * - useModernClass: boolean - Use class keyword (5.38+). Default: false
   * - packageName: string - Package name. Default: 'main'
   * - addTypeComments: boolean - Add type hints in comments. Default: true
   */
  // Framework base classes that need stub packages
  const FRAMEWORK_CLASSES = new Set([
    'BlockCipherAlgorithm', 'StreamCipherAlgorithm', 'HashFunctionAlgorithm',
    'AsymmetricAlgorithm', 'MacAlgorithm', 'KdfAlgorithm', 'ChecksumAlgorithm',
    'ClassicalCipherAlgorithm', 'CompressionAlgorithm', 'EncodingAlgorithm',
    'EccAlgorithm', 'SpecialAlgorithm',
    'IBlockCipherInstance', 'IStreamCipherInstance', 'IHashFunctionInstance',
    'IAlgorithmInstance'
  ]);

  // Well-known Instance-interface property names this codebase's algorithms
  // always expose through a get/set accessor pair (never a raw public
  // field) - the same enumerated list the test harness itself uses to
  // generically apply test-vector fields onto a constructed instance (see
  // tests/TranspilerValidationSuite.js's "_setup_instance_pl"/
  // "_set_test_property" property-name allowlist, which this mirrors) -
  // used by _isCipherInstanceRef()'s call sites in transformMemberExpression/
  // transformAssignmentExpression to decide whether a CROSS-FILE property
  // access/assignment ("this.cshake.customization = ...", "cipher1.iv = ...")
  // must be routed through the target object's accessor method rather than
  // a raw hash-key read/write - see e.g. hash/tuplehash.js's/parallelhash.js's
  // TupleHash/ParallelHash instance copying its own `customization`/
  // `outputSize`/`xofMode` onto an internal cSHAKE sub-instance: writing
  // "$self->{cshake}->{customization} = ..." (a literal hash key, previously
  // the only case handled was the narrower 'key' special-case below) silently
  // never reached cSHAKEInstance's own "$self->{'_customization'}"-backed
  // accessor, so the customization string was always dropped and every
  // vector using a non-empty customization/functionName produced the exact
  // same (wrong) hash as the empty-customization case.
  const CROSS_INSTANCE_ACCESSOR_PROPS = new Set([
    'key', 'iv', 'nonce', 'aad', 'associatedData', 'tag', 'counter', 'tweak',
    'salt', 'info', 'outputSize', 'keySize', 'blockSize', 'rounds', 'skip',
    'publicKey', 'privateKey', 'hashFunction', 'skipBytes', 'label',
    'iterations', 'secret', 'modulo', 'count', 'p', 'm', 'hashAlgorithm',
    'outputLength', 'multiplier', 'macSize', 'keyInput', 'customization',
    'n', 'increment', 'counterBits', 'context', 'aiv', 'xofMode',
    'functionName'
  ]);

  // Framework utility classes that should be skipped entirely (provided by runtime)
  const SKIP_CLASSES = new Set([
    'LinkItem', 'KeySize', 'Vulnerability', 'TestCase', 'AuthResult',
    'Algorithm', 'MacAlgorithm', 'AeadAlgorithm', 'RandomAlgorithm',
    'CipherModeAlgorithm', 'PaddingAlgorithm', 'SignatureAlgorithm',
    'KeyExchangeAlgorithm', 'KeyAgreementAlgorithm', 'ErrorCorrectionAlgorithm',
    'CryptoAlgorithm', 'IMacInstance', 'IAeadInstance', 'IKdfInstance',
    'IEncodingInstance', 'ICompressionInstance', 'IAsymmetricInstance',
    'IClassicalCipherInstance', 'IRandomInstance', 'IEccInstance',
    'ICryptoModeInstance', 'IRandomGeneratorInstance', 'IErrorCorrectionInstance',
    'ICryptoInstance', 'ICipherModeInstance', 'IPaddingInstance',
    'ISignatureInstance', 'IKeyExchangeInstance', 'IKeyAgreementInstance',
    'IChecksumInstance'
  ]);

  class PerlTransformer {
    constructor(options = {}) {
      this.options = options;
      this.variableTypes = new Map();  // Maps variable name -> PerlType
      this.scopeStack = [];
      this.currentClass = null;
      this.inMethod = false;
      this.requiredModules = new Map();  // Maps module name -> Set of imported functions
      this.currentModule = null;  // Track current module being built
      this.frameworkClasses = new Set();  // Track framework classes for stub generation
      this.functionNames = new Set();  // Track names that are functions (for code refs)
      // Subset of functionNames declared as a nested "function foo() {...}"
      // INSIDE another function/method body (see _buildFunctionSub's doc
      // comment and its "isNested" parameter), as opposed to a genuine
      // module-top-level function declaration. A nested declaration is
      // compiled into whatever package is lexically active at that point
      // in the source (the enclosing class's package, e.g.
      // "Gimli24HashInstance"), NOT "package main" - unlike a real
      // top-level function (always emitted at module scope, which always
      // lands in package main - see PerlEmitter.js emitModule). Called
      // from a class method as a bare "stateToBytes()", both look
      // identical at the call site, but only the genuine top-level case
      // needs (and must have) the "main::" qualification prefix; adding it
      // for a nested one is simply wrong (main::stateToBytes was never
      // defined) and died "Undefined subroutine &main::stateToBytes called".
      this.nestedFunctionNames = new Set();
      // Name of the class method whose body is currently being transformed
      // (null at module/top level) - see _collectNestedFunctionRenames' doc
      // comment for why this is needed alongside nestedFunctionNames.
      this.currentMethodName = null;
      // Map<methodName + " " + funcName, renamedFuncName> for the class
      // currently being transformed - see _collectNestedFunctionRenames'
      // doc comment. Empty/absent entries mean "keep the original name".
      this.currentClassNestedFuncRenames = new Map();
      this.codeRefVariables = new Set();  // Track variable names that hold code references (sub { ... })
      // Track local variable names known to hold a reference to the OpCodes
      // module itself - e.g. "const OC = typeof OpCodes !== 'undefined' ?
      // OpCodes : global.OpCodes;" (see e.g. algorithms/block/forkskinny.js,
      // algorithms/aead/forkae.js). Without this, "OC.Hex8ToBytes(...)"
      // isn't recognized as an OpCodes call at all (transformCallExpression's
      // "Handle OpCodes method calls" check requires the literal identifier
      // name "OpCodes") - it fell through to a generic "$OC->Method(...)"
      // indirect-method-call instead, which only works if a real
      // "OpCodes::Hex8ToBytes" sub exists (case-sensitive); the runtime
      // fallback stub package only defines lowercased names
      // (OpCodes::hex8tobytes), so this died "Can't locate object method
      // Hex8ToBytes via package OpCodes".
      this.opCodesAliasNames = new Set();
      this.definedClassNames = new Set();  // Track class names defined during transformation
      this.classesWithConstructor = new Set();  // Track classes whose constructor became a BUILD method (so subclasses can SUPER::BUILD into it)
      this.classAccessors = new Map();  // className -> Set of get/set-backed property names
      this.classBaseClassName = new Map();  // className -> its declared base class name (or null)
      this.destructureCounter = 0;  // Counter for unique destructuring variable names
      this.mapCounter = 0;  // Counter for map result variables when index is used
      this.createInstanceVarNames = new Set();  // Variable/field names initialized from a .CreateInstance(...) call (see _isCipherInstanceRef)
      this.stringVariables = new Set();  // Local variable names whose initializer was structurally identified as a string (see isStringType) - lets later Identifier references of that variable also be recognized as strings (e.g. "for (const c of normalizedInput)")
      this.stringSplitVarNames = new Set();  // Local variable names whose initializer is directly a String.prototype.split(...) call (IL 'StringSplit' node) - see transform()'s _collectStringSplitVarNames prescan and transformForOfStatement's use of it. Deliberately NOT based on the shared parser's own per-reference resultType tag: that tag is unreliable for chained calls like "Object.keys(x).map(Number)" (settles on Object.keys' own "string[]" while ignoring the following ".map(Number)", observed to tag the SAME variable "string[]" at one reference and "int32[]" at another) - trusting it broadly misclassified a genuinely-numeric loop variable as a string (compression/fse.js's "for (const symbol of symbols)", corrupting "normalized[symbol] = norm" into a hash-key assignment). A direct structural StringSplit check has no such ambiguity: split() is unconditionally string[]-producing in JS.
      this.topLevelFunctionStringParams = new Map();  // top-level (module-scope) function name -> Set of parameter names that every call site (anywhere in the file) passes a structurally-string argument for - see transform()'s _collectTopLevelFunctionStringParams prescan and transformFunctionDeclaration's use of it (mirrors transformClassDeclaration's per-class callSiteStringParams, but for plain "function foo(str) {...}" helpers, which have no "this.foo(...)" call sites for that mechanism to see)
      this.classStringGetters = new Map();  // className -> Set of get-accessor property names whose return value was structurally identified as a string (e.g. "get key() { return this._processedKey || 'A'; }") - lets this.key be recognized as a string, not just this.key[i]
      this.currentClassName = null;  // Name of the class currently being transformed (for classStringGetters lookups)
      this.classLengthFieldMethods = new Map();  // className -> Set of method names whose return statement(s) are an object literal with a "length" property (e.g. "_findLongestMatch() { return {distance, length}; }") - common in LZ-family compression matchers. Lets "match.length" resolve to the hash key $match->{'length'} instead of the array/string ArrayLength (scalar(@{...})/length()) built-in.
      this.objectLengthVariables = new Set();  // Local variable names assigned from a call to a classLengthFieldMethods-flagged method
      this.callSiteStringParams = new Map();  // methodName -> Set of parameter names that every this.<method>(...) call site in the current class passes a structurally-string argument for (see the prescan in transformClassDeclaration) - lets a parameter with no local usage-based evidence (e.g. only ever compared "matrix[r][c] === char") still be recognized as a string.
      this.classFunctionReturningMethods = new Map();  // className -> Set of method names whose return statement(s) are all structurally a FunctionExpression/ArrowFunctionExpression (e.g. "_getHMACFunction() { if (...) return (k,m) => ...; else return (k,m) => ...; }") - lets "const f = this._getHMACFunction(); f(a, b);" recognize f as a code-ref variable (needs "$f->(a, b)", not a bareword "f(a, b)" call) the same way codeRefVariables already does for a directly-assigned arrow function.
    }

    /**
     * Add a required module with optional function import
     * @param {string} moduleName - Module name (e.g., 'List::Util', 'POSIX')
     * @param {string} [funcName] - Optional function to import
     */
    addRequiredModule(moduleName, funcName = null) {
      if (!this.requiredModules.has(moduleName))
        this.requiredModules.set(moduleName, new Set());
      if (funcName)
        this.requiredModules.get(moduleName).add(funcName);
    }

    /**
     * Wrap expression for array/list context, avoiding double sigils.
     * If expression is already a bare @ array, return it directly.
     * Otherwise wrap with @{...} dereference.
     * @param {PerlNode} expr - Perl AST expression
     * @returns {PerlNode} Expression suitable for list context
     */
    wrapArrayDeref(expr) {
      // Already an array-sigiled identifier (@arr) - no wrapping needed
      if (expr.nodeType === 'Identifier' && expr.sigil === '@')
        return expr;

      // Already a @ unary expression - no double wrap
      if (expr.nodeType === 'UnaryExpression' && expr.operator === '@')
        return expr;

      // RawCode that starts with [ is an array literal/slice - just use @{...}
      // But if it's a complex expression like [@{...}[...]] we need to handle it
      if (expr.nodeType === 'RawCode') {
        const code = expr.code;
        // Explicitly flagged as evaluating to an arrayref *scalar* (e.g. the
        // 'TypedArraySubarray' case's "do { ...; \@__sav }" tied-array-view
        // builder - a "do {}" block doesn't start with '[', so it would
        // otherwise fall through to "assume it's already a list" below and
        // get passed as a single scalar instead of its flattened elements -
        // e.g. splice()'s replacement-list argument silently became a
        // 1-element list containing the arrayref itself instead of the
        // subarray's actual bytes). Needs the same "@{...}" wrap as a plain
        // arrayref variable.
        if (expr.isArrayRefValue)
          return new PerlUnaryExpression('@', expr, true);
        // If it's an array constructor like [...], use @{...}
        if (code.startsWith('[') && code.endsWith(']'))
          return new PerlUnaryExpression('@', expr, true);
        // Otherwise return as-is (it might already be a list expression)
        return expr;
      }

      // Perl built-in functions that already return lists - no @ prefix needed
      // Adding @ would create invalid syntax like @keys(...) instead of keys(...)
      const listReturningFunctions = new Set([
        'keys', 'values', 'each', 'sort', 'reverse', 'map', 'grep',
        'split', 'unpack', 'localtime', 'gmtime', 'caller', 'stat', 'lstat'
      ]);

      // Check if expr is a call to a list-returning function
      if (expr.nodeType === 'Call') {
        const callee = expr.callee;
        // Handle string callee directly
        if (typeof callee === 'string' && listReturningFunctions.has(callee))
          return expr;
        // Handle Identifier callee
        if (callee && callee.nodeType === 'Identifier' && listReturningFunctions.has(callee.name))
          return expr;
      }

      // Wrap with @{...} for list context dereference
      return new PerlUnaryExpression('@', expr, true);
    }

    /**
     * Wrap expression for hash context, avoiding double sigils.
     * If expression is already a bare % hash, return it directly.
     * Otherwise wrap with %{...} dereference.
     * @param {PerlNode} expr - Perl AST expression
     * @returns {PerlNode} Expression suitable for hash context
     */
    wrapHashDeref(expr) {
      // Already a hash-sigiled identifier (%hash) - no wrapping needed
      if (expr.nodeType === 'Identifier' && expr.sigil === '%')
        return expr;

      // Already a % unary expression - no double wrap
      if (expr.nodeType === 'UnaryExpression' && expr.operator === '%')
        return expr;

      // RawCode that starts with { is a hash literal - just use %{...}
      if (expr.nodeType === 'RawCode') {
        const code = expr.code;
        if (code.startsWith('{') && code.endsWith('}'))
          return new PerlUnaryExpression('%', expr, true);
        return expr;
      }

      // Wrap with %{...} for hash context dereference
      return new PerlUnaryExpression('%', expr, true);
    }

    /**
     * Build a JS-Array.prototype.slice-equivalent Perl expression, given
     * already-transformed start/end operand nodes (either may be null,
     * meaning that argument was omitted). Shared by the 'ArraySlice' IL
     * node case and the .slice() CallExpression-method-dispatch fallback
     * (see both call sites).
     *
     * JS's slice(start, end) resolves a *negative* start or end by
     * counting from the array's end (effective index = max(length+index,
     * 0)) - not always knowable at transform time, since the argument can
     * be an arbitrary computed expression rather than a literal (e.g.
     * ecc/bch-code.js's "result.slice(-(divisorLen - 1))", ecc/hamming.js's
     * "received.slice(0, -this._shortened)"). Perl's ".." range operator
     * has no such "negative counts from the end" behavior for array-slice
     * subscripts by itself - it just enumerates every integer from a
     * negative left value up through a positive right value (e.g.
     * "-2..6" enumerates NINE indices: -2,-1,0,...,6, several duplicating
     * the intended slice), corrupting both the result's length and
     * content. Each present argument is normalized via a runtime ternary,
     * evaluated through a temp variable (so a non-trivial argument
     * expression is never evaluated twice) - every temp declaration lives
     * in one shared "do {...}" block so start and end can both be
     * normalized without nesting. Reduces to exactly the pre-existing
     * (simpler) codegen whenever both operands are actually >= 0, the
     * overwhelmingly common case.
     * @param {PerlNode} sliceArr - already-transformed array expression
     * @param {PerlNode|null} startNode - already-transformed start operand, or null if omitted
     * @param {PerlNode|null} endNode - already-transformed end operand, or null if omitted
     * @returns {PerlNode}
     */
    _buildArraySliceExpr(sliceArr, startNode, endNode) {
      const decls = [];
      const arrLenExpr = () => new PerlCall('scalar', [this.wrapArrayDeref(sliceArr)]);
      const normalize = (node, prefix) => {
        const tmpName = `${prefix}${this._arraySliceTmpCounter = (this._arraySliceTmpCounter || 0) + 1}`;
        const tmpIdent = new PerlIdentifier(tmpName, '$');
        decls.push(new PerlVarDeclaration('my', tmpName, '$', node));
        const adjusted = new PerlConditional(
          new PerlBinaryExpression(tmpIdent, '>=', PerlLiteral.Number(0)),
          tmpIdent,
          new PerlBinaryExpression(arrLenExpr(), '+', tmpIdent)
        );
        // Clamp into [0, len], matching JS's Array.prototype.slice index
        // clamping - Perl's ".." range operator (used below to build the
        // actual slice) has no such clamping, so an end index past the
        // array's length (e.g. a stream cipher's final, shorter-than-
        // blockSize chunk sliced as "data.slice(i, i + blockSize)")
        // silently produced trailing undef elements instead of JS's
        // shorter, clamped result - corrupting anything downstream that
        // assumed the slice's length matched the requested size (e.g.
        // XORing it against a same-length keystream block, "Use of
        // uninitialized value ... in bitwise xor").
        this.addRequiredModule('List::Util', 'min');
        this.addRequiredModule('List::Util', 'max');
        return new PerlCall(new PerlMemberAccess(new PerlIdentifier('List::Util'), new PerlIdentifier('max'), '::'), [
          PerlLiteral.Number(0),
          new PerlCall(new PerlMemberAccess(new PerlIdentifier('List::Util'), new PerlIdentifier('min'), '::'), [arrLenExpr(), adjusted])
        ]);
      };

      const start = startNode ? normalize(startNode, '_as_start') : PerlLiteral.Number(0);
      const end = endNode
        ? new PerlBinaryExpression(normalize(endNode, '_as_end'), '-', PerlLiteral.Number(1))
        : new PerlUnaryExpression('$#', sliceArr, true);

      const sliceExpr = new PerlArray([new PerlArraySlice(sliceArr, start, end)]);
      if (decls.length === 0) return sliceExpr;
      // NOT wrapped in PerlGrouped: emitUnaryExpression's '@'/'%'/'$#'
      // dereference-bracing special-case (see PerlEmitter.js) detects a
      // "do {...}" operand needing "@{(do{...})}" bracing by regex-
      // matching the emitted text against /^(map|grep|sort|reverse|do)\b/
      // - wrapping the PerlCall in an extra PerlGrouped changes that
      // emitted text to "(do {...})" (leading "(", not "do"), missing the
      // match entirely and falling through to the unwrapped "@" + operand
      // default - a hard Perl syntax error ("@(do {...})" is not valid
      // deref syntax) wherever this slice's result is later array-
      // dereferenced (e.g. spread into a bigger array literal,
      // ArrayConcat's wrapArrayDeref). Compare transformExpression's
      // 'ArrayLength' case, which returns the bare "new PerlCall('do',
      // [block])" for the same "compute via a temp-var do-block" idiom,
      // with no such wrapper.
      return new PerlCall('do', [new PerlBlock([...decls, new PerlExpressionStatement(sliceExpr)])]);
    }

    /**
     * Transform a callback for List::Util style functions that use $_ for the current element.
     * Takes a JS arrow/function expression and produces a Perl block that uses $_ instead of the first parameter.
     * @param {Object} callback - JS AST callback node (ArrowFunctionExpression or FunctionExpression)
     * @returns {PerlBlock} Perl block using $_
     */
    transformListUtilCallback(callback) {
      if (!callback) return new PerlBlock([]);

      // Get the parameter name to replace with $_
      const params = callback.params || [];
      const paramName = params.length > 0 ? (params[0].name || (params[0].type === 'Identifier' ? params[0].name : null)) : null;

      if (this.options.debug) console.log('transformListUtilCallback paramName:', paramName, 'body type:', callback.body?.type);

      // Save and set up parameter replacement context
      const oldReplacement = this._listUtilParamReplacement;
      this._listUtilParamReplacement = paramName;

      // Transform the body
      let body;
      if (callback.body) {
        if (callback.body.type === 'BlockStatement') {
          // Full block body
          body = new PerlBlock();
          for (const stmt of callback.body.body) {
            const transformed = this.transformStatement(stmt);
            if (transformed) {
              if (Array.isArray(transformed))
                body.statements.push(...transformed);
              else
                body.statements.push(transformed);
            }
          }
        } else {
          // Expression body (arrow function shorthand) - could be any IL node type
          if (this.options.debug) console.log('transformListUtilCallback expression body ilNodeType:', callback.body.ilNodeType);
          const expr = this.transformExpression(callback.body);
          if (this.options.debug) console.log('transformListUtilCallback result expr:', expr?.nodeType);
          const stmt = new PerlExpressionStatement(expr);
          body = new PerlBlock();
          body.statements.push(stmt);
        }
      } else {
        body = new PerlBlock();
      }

      // Restore context
      this._listUtilParamReplacement = oldReplacement;

      return body;
    }

    /**
     * array.every(fn)/array.some(fn) where fn takes a 2nd (index) parameter
     * - e.g. "seed.every((val, idx) => val === expected[idx])". List::Util's
     * all/any only ever bind the current element to "$_" inside their block
     * (see transformListUtilCallback) - a body referencing the callback's
     * own 2nd parameter name would resolve to a completely undeclared Perl
     * variable ("Global symbol "$idx" requires explicit package name").
     * Falls back to an explicit C-style indexed loop instead, which (unlike
     * the $_-block form) can bind arbitrarily many of the callback's actual
     * parameter names as real lexicals, matching JS's (element, index[,
     * array]) callback signature exactly. Only the common
     * expression-bodied-arrow predicate shape is handled (the only shape
     * that occurs anywhere in this repo); a block-bodied callback here
     * falls through unhandled deliberately rather than guessing at
     * synthesizing a real return-value flow through a manual loop.
     * @param {object} arrayNode raw JS AST node for the receiver array
     * @param {object} callback raw JS AST ArrowFunctionExpression/FunctionExpression
     * @param {boolean} isEvery true for .every (AND-reduce), false for .some (OR-reduce)
     * @returns {PerlNode}
     */
    _transformIndexedEverySome(arrayNode, callback, isEvery) {
      const arrExpr = this.transformExpression(arrayNode);
      const valName = (callback.params[0] && callback.params[0].name) || '_val';
      const idxName = (callback.params[1] && callback.params[1].name) || '_idx';
      const n = (this._indexedEverySomeCounter = (this._indexedEverySomeCounter || 0) + 1);
      const arrTmp = `_ies_arr${n}`;
      const okTmp = `_ies_ok${n}`;

      const oldReplacement = this._listUtilParamReplacement;
      this._listUtilParamReplacement = null; // bind real names, not "$_"
      const cond = callback.body && callback.body.type !== 'BlockStatement'
        ? this.transformExpression(callback.body)
        : PerlLiteral.Undef(); // unhandled block-bodied shape - see doc comment
      this._listUtilParamReplacement = oldReplacement;

      const loopBody = new PerlBlock([
        new PerlVarDeclaration('my', valName, '$', new PerlSubscript(new PerlIdentifier(arrTmp, '@'), new PerlIdentifier(idxName, '$'), 'array', false)),
        isEvery
          ? new PerlIf(new PerlUnaryExpression('!', new PerlGrouped(cond), true), new PerlBlock([
              new PerlExpressionStatement(new PerlAssignment(new PerlIdentifier(okTmp, '$'), '=', PerlLiteral.Number(0))),
              new PerlLast()
            ]))
          : new PerlIf(cond, new PerlBlock([
              new PerlExpressionStatement(new PerlAssignment(new PerlIdentifier(okTmp, '$'), '=', PerlLiteral.Number(1))),
              new PerlLast()
            ]))
      ]);

      const forLoop = new PerlFor(null, null, loopBody);
      forLoop.isCStyle = true;
      forLoop.init = new PerlVarDeclaration('my', idxName, '$', PerlLiteral.Number(0));
      forLoop.condition = new PerlBinaryExpression(new PerlIdentifier(idxName, '$'), '<', new PerlCall('scalar', [new PerlIdentifier(arrTmp, '@')]));
      forLoop.increment = new PerlUnaryExpression('++', new PerlIdentifier(idxName, '$'), false);

      const block = new PerlBlock([
        new PerlVarDeclaration('my', arrTmp, '@', new PerlUnaryExpression('@', arrExpr, true)),
        new PerlVarDeclaration('my', okTmp, '$', PerlLiteral.Number(isEvery ? 1 : 0)),
        forLoop,
        new PerlExpressionStatement(new PerlIdentifier(okTmp, '$'))
      ]);
      return new PerlCall('do', [block]);
    }

    /**
     * Transform a JavaScript AST to a Perl AST
     * @param {Object} jsAst - JavaScript AST from parser
     * @returns {PerlModule} Perl AST
     */
    transform(jsAst) {
      const module = new PerlModule(this.options.packageName || 'main');

      // Add pragmas
      if (this.options.useStrict !== false) {
        module.pragmas.push('use strict');
      }
      if (this.options.useWarnings !== false) {
        module.pragmas.push('use warnings');
      }

      // Add feature pragmas for modern Perl
      if (this.options.addSignatures) {
        module.pragmas.push('use feature qw(signatures)');
        module.pragmas.push('no warnings qw(experimental::signatures)');
      }

      // Reset tracking for this transformation
      this.requiredModules.clear();
      this.frameworkClasses.clear();
      this.currentModule = module;
      this.usesRegisterAlgorithm = false;
      this.usesAlgorithmFrameworkFind = false;
      this.usesOpCodesRuntimeFallback = false;
      this.usesLegacyAlgoObj = false;
      this._forceSelfParam = false;

      // Stack of statically-estimated max-iteration-count bounds for
      // enclosing C-style for-loops (see _estimateForLoopBound and its use
      // in transformForStatement/the self-referential shift-accumulate
      // assignment case in transformAssignmentExpression) - innermost loop
      // is the last element.
      this._loopBoundStack = [];

      // Pre-scan the whole source for "this.field = new Array(...)" / "this.field = []"
      // style initializations, wherever in the file they occur (often a
      // dedicated key-expansion method, not the constructor). isArrayContext()
      // uses this to decide $self->{field}[i] (array) vs $self->{field}{i}
      // (hash) for this.field[computedIndex] reads/writes elsewhere in the
      // class - field-name heuristics alone miss plenty of real array fields
      // (e.g. Kasumi's KOi1/KOi2/KIi1/... round-subkey arrays).
      this._localArrayVarNames = new Set();
      this._localHashVarNames = new Set();

      // Whole-file prescan: plain top-level "function foo(str) {...}"
      // helpers (module-scope, not a class method) get no benefit from
      // transformClassDeclaration's callSiteStringParams (that only scans
      // "this.method(...)" calls inside a class) - see
      // _collectTopLevelFunctionStringParams's doc comment.
      this.topLevelFunctionStringParams = this._collectTopLevelFunctionStringParams(jsAst);

      // Whole-file prescan: local variables initialized directly from a
      // String.prototype.split(...) call - see stringSplitVarNames' doc
      // comment (declared above) and transformForOfStatement's use of it.
      this.stringSplitVarNames = this._collectStringSplitVarNames(jsAst);
      // hashFieldNames mirrors arrayFieldNames but for "this.field = {}"
      // (and object-literal-property) initializations - see isArrayContext(),
      // which now consults it with priority over its numeric/loop-variable
      // key-shape guesses whenever the *container*'s own declared shape is
      // known (a round-indexed state dict like "this.coordsToLetter = {}"
      // is still a hash even when later read as "coordsToLetter[computedIdx]").
      this.hashFieldNames = new Set();
      this.arrayFieldNames = this._collectArrayFieldNames(jsAst, undefined, this.hashFieldNames);
      // Merge in local "const x = [...]" names collected above, minus any
      // name also seen assigned an object literal elsewhere in the file
      // (ambiguous - see the comment in _collectArrayFieldNames).
      for (const name of this._localArrayVarNames) {
        if (!this._localHashVarNames.has(name)) this.arrayFieldNames.add(name);
      }
      // Second pass: object-literal properties whose value is a plain
      // array/hash literal, or a shorthand/aliasing reference to an
      // already-known local array/hash variable (e.g. "{ limit }" aliasing
      // "const limit = new Int32Array(...)", or "{ counts: new
      // Array(256).fill(0), total: 0 }") - run after the first pass so
      // _localArrayVarNames/_localHashVarNames are fully populated
      // regardless of source order.
      this._collectObjectLiteralPropertyShapes(jsAst, this.arrayFieldNames, this.hashFieldNames);
      // Drop any name this pass or the first pass disagree on (also seen
      // producing the opposite shape) - same imprecision trade-off as the
      // local-array/local-hash merge above; ambiguous names fall back to
      // isArrayContext's ordinary key-shape/name-pattern heuristics.
      for (const name of Array.from(this.arrayFieldNames)) {
        if (this.hashFieldNames.has(name)) { this.arrayFieldNames.delete(name); this.hashFieldNames.delete(name); }
      }

      // Third pass: "this.field = this._method();"/"this.field =
      // someHelper();" where the called method's own body is "const t =
      // new Array(n); ...; return t;" rather than a bare "this.field = new
      // Array(...)" (e.g. raptor-codes.js's "this.intermediateSymbols =
      // this._preCodeEncode();", whose body builds a local array and
      // returns it) - mirrors the mapReturningMethodNames/setReturningMethodNames
      // two-step pattern above (_collectTypedReturningMethodNames feeding
      // _collectTypedVarNames), but for the array/hash shape tracked by
      // _classifyLiteralShape instead of an exact IL node type. Run after
      // the first two passes so _localArrayVarNames/_localHashVarNames (used
      // by _classifyLiteralShape to resolve "return t;") are fully populated.
      // Without this, "this.intermediateSymbols[intIdx]" elsewhere in the
      // class defaulted to hash access, dying with "Not a HASH reference"
      // (the field actually holds a plain arrayref).
      const arrayReturningMethodNames = this._collectShapeReturningMethodNames(jsAst, 'array');
      const hashReturningMethodNames = this._collectShapeReturningMethodNames(jsAst, 'hash');
      this._collectMethodResultFieldNames(jsAst, arrayReturningMethodNames, this.arrayFieldNames, hashReturningMethodNames, this.hashFieldNames);
      for (const name of Array.from(this.arrayFieldNames)) {
        if (this.hashFieldNames.has(name)) { this.arrayFieldNames.delete(name); this.hashFieldNames.delete(name); }
      }

      // Pre-scan for "const x = something.CreateInstance(...)" /
      // "this.field = something.CreateInstance(...)" - the unambiguous,
      // codebase-wide pattern for obtaining a sub-cipher/hash instance
      // (whose 'key' property is backed by a get/set accessor defined in
      // whatever other file that class lives in - see _isCipherInstanceRef,
      // which this feeds so it isn't limited to names ending in "cipher").
      this.createInstanceVarNames = this._collectCreateInstanceVarNames(jsAst);

      // Pre-scan for "const x = Math.imul(a, b)" - feeds the 'Floor' IL
      // case's sign-correction (see its call site's doc comment for the
      // full explanation of why a Math.imul result specifically needs this).
      this._imulResultVarNames = this._collectImulResultVarNames(jsAst);

      // Pre-scan for "this.FIELD = 'string literal'" field initializations,
      // mirroring _collectArrayFieldNames but for strings - classical-cipher
      // constant tables like "this.ALPHABET = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';"
      // are plain strings indexed elsewhere as "someObj.algorithm.ALPHABET[i]"
      // (JS bracket-indexes a string into a 1-char substring). isStringType()
      // only had resultType/structural signals, which don't reach through a
      // cross-object hop like ".algorithm.ALPHABET" (the IL's static type
      // flow doesn't track a string property through an aliased "this.algorithm
      // = algorithm" constructor param) - so that computed access fell through
      // to isArrayContext's default and was emitted as an array/hash
      // dereference of the (actual, runtime) string value, dying with "Can't
      // use string ... as an ARRAY ref". A flat whole-file field-name scan
      // (same imprecision trade-off _collectArrayFieldNames already makes)
      // fixes the common case regardless of which object it's read through.
      this.stringFieldNames = this._collectStringFieldNames(jsAst);

      // Whole-file scan for array fields whose *elements* (not the field
      // itself) are strings - e.g. classical/enigma.js's per-rotor wiring
      // sequences ("this.rotorWirings[i] = this.ROTOR_I;"). See
      // _collectArrayOfStringFieldNames's doc comment. Run as a small
      // fixed-point loop (mirrors classStringGetters' 3-pass loop) so a
      // whole-field assignment sourced from another same-file field/getter
      // (e.g. "this.wheels = this.defaultWheels.slice(...)") resolves
      // regardless of file order between the two.
      this.arrayOfStringFieldNames = new Set();
      for (let pass = 0; pass < 3; ++pass) {
        const before = this.arrayOfStringFieldNames.size;
        this._collectArrayOfStringFieldNames(jsAst, this.arrayOfStringFieldNames);
        if (this.arrayOfStringFieldNames.size === before) break;
      }

      // Whole-file scan for local array variables that are ever pushed a
      // {..., length: ...}-shaped object literal (e.g. LZ77 tokenizers:
      // "tokens.push({ type: 'match', distance, length, literal });") - lets
      // transformForOfStatement() flag the per-iteration loop variable of
      // "for (const token of tokens)" as a length-field object too, so
      // "token.length" inside the loop resolves to the hash key instead of
      // the built-in ArrayLength. See classLengthFieldMethods/
      // objectLengthVariables for the sibling "returned from a method" case.
      this.lengthFieldArrayVarNames = this._collectLengthFieldArrayVarNames(jsAst);

      // See _collectAnyClassLengthFieldMethodNames' doc comment - the
      // classLengthFieldMethods per-class registry (populated as each class
      // is transformed, below) only covers "this.method()" calls; this flat
      // whole-file pre-scan covers "otherInstance.method()" calls too.
      this.anyClassLengthFieldMethodNames = this._collectAnyClassLengthFieldMethodNames(jsAst);

      // Whole-file scan for local variables and this.field members
      // initialized from "new Map()"/"new Set()" (already converted to the
      // shared parser's 'MapCreation'/'SetCreation' IL nodes by this point -
      // see transformExpression's MapCreation/SetCreation cases, which back
      // both with a plain Perl hashref). JS Map/Set instance methods
      // (get/set/has/delete/clear/...) have no meaning on a bare hashref
      // (blows up with "Can't call method ... on unblessed reference") -
      // transformCallExpression's mapVarNames/setVarNames-driven rewriting
      // translates them to native Perl hash operations instead
      // (get->subscript read, set->subscript write, has->exists, etc.).
      const mapReturningMethodNames = this._collectTypedReturningMethodNames(jsAst, 'MapCreation');
      const setReturningMethodNames = this._collectTypedReturningMethodNames(jsAst, 'SetCreation');
      this.mapVarNames = this._collectTypedVarNames(jsAst, 'MapCreation', mapReturningMethodNames);
      this.setVarNames = this._collectTypedVarNames(jsAst, 'SetCreation', setReturningMethodNames);
      this.mapFieldNames = this._collectTypedFieldNames(jsAst, 'MapCreation');
      this.setFieldNames = this._collectTypedFieldNames(jsAst, 'SetCreation');

      // Container-of-Set fields: "this.field = new Array(n).fill(x).map(() =>
      // new Set())" (array of Sets, e.g. fountain-code sparse-matrix
      // row/column non-zero-index sets) and "this.field.set(k, new Set())"
      // (Map whose values are themselves Sets, e.g. bipartite-graph
      // adjacency lists). Neither is caught by mapFieldNames/setFieldNames
      // above (those only match a field whose own initializer IS a bare
      // MapCreation/SetCreation node) - a later "this.field[i].add(x)" or
      // "this.field.get(k).add(x)" call site falls through to a generic
      // method call, dying with "Can't call method add on unblessed
      // reference" (the target is a plain arrayref/hashref, not blessed -
      // JS Set/Map have no Perl class backing them, by design, see above).
      // See _transformMapOrSetMethodCall's use of these two sets.
      this.setArrayFieldNames = this._collectSetArrayFieldNames(jsAst);
      this.mapOfSetFieldNames = this._collectMapOfSetFieldNames(jsAst);

      // Fields assigned a bare reference to a top-level helper function -
      // e.g. aead/elephant.js's "this.permute = spongent160Permute;" (later
      // called as "this.permute(state)") where spongent160Permute is one of
      // several interchangeable top-level "function spongentNNNPermute(state)
      // {...}" permutation implementations picked per variant. A later
      // "this.permute(...)" call reaching the generic ThisMethodCall
      // handling assumed it names a real class method ("$self->permute(...)"),
      // dying "Can't locate object method permute"/"Undefined subroutine
      // ...::permute" (there is no such method - "permute" is a plain data
      // field holding a code reference, needing "$self->{'permute'}->(...)"
      // instead). Mirrors codeRefVariables' identical local-variable case
      // (see its doc comment) and classFunctionReturningMethods' (this.method()
      // returning a function). Run as a flat, order-independent whole-file
      // scan (same trade-off as every other field-name prescan here) rather
      // than relying on functionNames already having seen the helper's own
      // declaration by the time the assignment is transformed.
      const topLevelFunctionNames = this._collectTopLevelFunctionNames(jsAst);
      this.codeRefFieldNames = this._collectCodeRefFieldNames(jsAst, topLevelFunctionNames);
      // Retained for transformLetStatement's "const x = cond ? funcA : funcB;"
      // ConditionalExpression-of-function-references case (see its call
      // site comment) - e.g. aead/spook.js's "const permute = shadowSize
      // === 512 ? shadow512 : shadow384;", picking between two
      // interchangeable top-level permutation functions per variant.
      this._topLevelFunctionNames = topLevelFunctionNames;

      // Flat whole-file scan for every real "static FIELD = ...;" class
      // field name (ES2022 static class fields, e.g. block/aria.js's
      // "static SB1 = Object.freeze([...])") - see its use at isClassObj's
      // dataProps check (transformMemberExpression) for the full rationale.
      this.staticFieldNames = this._collectStaticFieldNames(jsAst);

      // Flat whole-file scan for every "static get NAME() {...}" getter
      // name - see its doc comment (transformMemberExpression's isClassObj
      // check must prefer this over the hardcoded dataProps guess).
      this.staticGetterNames = this._collectStaticGetterNames(jsAst);

      // Flat whole-file scan for object-literal property names whose value
      // is a code reference (a shorthand/aliased reference to a top-level
      // function, or an inline Function/ArrowFunctionExpression) - see
      // objectCoderefPropNames' doc comment at its use site in
      // transformCallExpression's generic "obj.method(args)" fallback.
      // Subtract every real class method name in the file (_collectClassMethodNames'
      // doc comment) - a real method call always wins over the coderef-call
      // heuristic when the same name is used both ways in one file.
      this.objectCoderefPropNames = this._collectObjectCoderefPropNames(jsAst, topLevelFunctionNames);
      const allClassMethodNames = this._collectClassMethodNames(jsAst);
      for (const name of allClassMethodNames) this.objectCoderefPropNames.delete(name);

      // A narrower ('method'-kind only, no accessors) flat whole-file set -
      // see _collectPlainClassMethodNames' doc comment - for the
      // 'ThisPropertyAccess' bare-method-value-reference case
      // (transformExpression) and transformCallExpression's ".call(
      // thisArg, ...)" handling (JS's Function.prototype.call idiom applied
      // to a bare "this.methodName"/"obj.methodName" reference, e.g.
      // hash/haval.js's "fpFunc.call(this, ...)" where fpFunc came from
      // "this.fp3_1" stored in an array earlier).
      this.allPlainClassMethodNames = this._collectPlainClassMethodNames(jsAst);

      // Whole-file heuristic used by transformUnaryExpression() ('~') and
      // transformBinaryExpression()/transformAssignmentExpression() ('+'/'-'/
      // '+='/'-=') to decide whether arithmetic/bitwise-complement operations
      // need 64-bit-safe handling: a file that uses any BigInt literal
      // anywhere is, in this codebase, always a 64-bit/BigInt-state hash or
      // PRNG (Tiger/Skein/Whirlpool/SHA-512/SipHash/BLAKE2b/...), never a mix
      // of real 32-bit `~`/`+`/`-` and BigInt state in the same file - see
      // _scanForBigIntLiterals()'s doc comment and PythonTransformer.js's
      // identical _fileHasBigIntLiterals heuristic.
      this._fileHasBigIntLiterals = this._scanForBigIntLiterals(jsAst);

      // See _scanForBigIntPow's doc comment - used to disable the self-
      // referential shift-accumulate assignment's "provably safe" 64-bit-
      // native-arithmetic shortcut for a file (like block/ff.js) that also
      // does genuine BigInt exponentiation/non-power-of-two-modulus
      // arithmetic elsewhere.
      this._fileUsesBigIntPow = this._fileHasBigIntLiterals && this._scanForBigIntPow(jsAst);

      // Flat whole-file scan for top-level "const NAME = <BigInt literal>;"
      // declarations whose value exceeds a native 64-bit width (e.g.
      // random/lehmer64.js's "const MASK_128 = 0xFFFF...FFFFn;", a 128-bit
      // all-ones mask) - see the '&'-of-'*'/'+'/'-' case in
      // transformBinaryExpression, which needs to tell such a mask apart
      // from an ordinary (<=64-bit) one like the same file's MASK_64
      // sibling constant (both share resultType 'uint64' - the type-aware
      // parser doesn't narrow a BigInt literal's resultType by its actual
      // magnitude - so only the literal's own value distinguishes them).
      this._wideBigIntConstNames = this._collectWideBigIntConstNames(jsAst);

      // Flat whole-file scan for "const NAME = <expr>" declarations
      // (unlike _wideBigIntConstNames above, NOT restricted to top level -
      // e.g. block/present.js's PRESENT-80 key schedule declares its
      // 19-bit extraction mask as a local "const mask = ..." INSIDE the
      // method) whose value structurally resolves to a narrow (< 64-bit)
      // bit-width bound - see _estimateMaxBitWidth's doc comment and its
      // call site (the '<<' case in transformBinaryExpression, which uses
      // this to detect a shift whose RESULT provably exceeds 64 bits even
      // though the shift amount itself is < 64, e.g. "(key & mask) << 61"
      // with mask a 19-bit extraction mask: 19 + 61 = 80 > 64).
      this._narrowMaskVarWidths = this._collectNarrowMaskVarWidths(jsAst);

      // Flat whole-file scan for "X[<computed>] = {};" - see
      // _collectArrayOfHashVarNames' doc comment. Run after arrayFieldNames/
      // hashFieldNames/_localArrayVarNames/_localHashVarNames above (already
      // populated by this point) since _classifyLiteralShape's identifier-
      // aliasing resolution depends on them being complete.
      this._arrayOfHashVarNames = this._collectArrayOfHashVarNames(jsAst);

      // Flat whole-file scan for "const NAME = A * B;" declarations (a bare
      // '*', not already covered by the '%'/'&'-of-'*' cases below) whose
      // result is later split into high/low 64-bit halves via a literal
      // ">> 64"-or-wider shift on that same NAME - e.g. mac/vmac.js's 64x64
      // -> 128-bit widening multiply idiom "const product = a * b; ...
      // const low64 = product & M64; const high64 = OpCodes.ShiftRn(product,
      // 64n);" (also its L3 finalization's "const prod = p1 * p2; let rh =
      // OpCodes.ShiftRn(prod, 64n);"). Both operands can be full 64-bit
      // BigInts, so the true product can reach ~128 significant bits - the
      // generic '*' case a BigInt-flagged file normally gets (u64mul, exact
      // only up to 64 bits inside a `use integer` block) truncates the
      // product to 64 bits *before* either the mask or the ">> 64" ever
      // runs, so the high half is always silently zero and the low half is
      // frequently wrong too (every VMAC tag came out wrong as a result,
      // even for an empty message, since the L3 finalization step above
      // always runs). Unlike the existing '%'/'&'-of-'*' cases (which only
      // catch the shape when the multiply is DIRECTLY nested inside the
      // outer '%'/'&' expression), this split happens through an
      // intermediate variable in a separate statement, which those
      // structural checks can't see - hence this dedicated whole-file scan.
      // A ">> 64"-or-wider shift is never meaningful on a value a genuine
      // 64-bit-wraparound algorithm would want truncated first (it would
      // always yield a constant 0), so gating on this shift shape alone -
      // without also needing to positively identify the multiply as
      // "widening" - is still safe: it only fires for names that
      // structurally can't be the ordinary truncating-multiply-then-rotate
      // idiom the rest of the BigInt-flagged '*' family relies on.
      this._wideProductVarNames = this._collectWideProductVarNames(jsAst);

      // Transform the JavaScript AST
      if (jsAst.type === 'Program') {
        for (const node of jsAst.body) {
          this.transformTopLevel(node, module);
        }
      }

      // Add required module imports to pragmas
      for (const [moduleName, funcs] of this.requiredModules) {
        if (funcs.size > 0) {
          const funcList = Array.from(funcs).join(' ');
          module.pragmas.push(`use ${moduleName} qw(${funcList})`);
        } else {
          module.pragmas.push(`use ${moduleName}`);
        }
      }

      // Note: Framework class stubs are generated by the emitter when emitting derived classes
      // This ensures base class stubs appear directly before the classes that need them

      // Flag so the emitter can add a no-op RegisterAlgorithm() stub when needed
      // (the real AlgorithmFramework registry is not present in standalone output)
      module.usesRegisterAlgorithm = this.usesRegisterAlgorithm;

      // Flag so the emitter can add the AlgorithmFramework::Find lookup stub
      module.usesAlgorithmFrameworkFind = this.usesAlgorithmFrameworkFind;

      // Flag so the emitter includes the inline OpCodes runtime package
      // backing OpCodes::<name> fallback calls (see transformOpCodesCall).
      module.usesOpCodesRuntimeFallback = this.usesOpCodesRuntimeFallback;

      // Flag so the emitter includes the _OpCodesBitStream package backing
      // "OpCodes.CreateBitStream(...)" (see transformOpCodesCall).
      module.usesBitStreamClass = this.usesBitStreamClass;

      // Flag so the emitter includes the _JSSubarrayView tied-array package
      // backing "typedArray.subarray(...)" (see the 'TypedArraySubarray' case
      // below) - only emitted when the source actually takes a subarray view.
      module.usesSubarrayView = this.usesSubarrayView;

      // Flag so the emitter includes the _LegacyAlgoObj AUTOLOAD-dispatch
      // package backing legacy "const X = {...method: function(){}...}"
      // object-literal algorithms (see transformObjectExpression's
      // function-property detection and the ObjectCreate ("Object.create(this)"
      // instance-clone pattern) case) - both bless into this package so the
      // harness's "$algo->CreateInstance(...)"/"$inst->Feed(...)" method-call
      // syntax resolves against the hash-stored coderefs instead of failing
      // with "Can't call method ... on unblessed reference".
      module.usesLegacyAlgoObj = this.usesLegacyAlgoObj;

      return module;
    }

    /**
     * Detect the "already registered" duplicate-registration guard that
     * wraps RegisterAlgorithm() calls in source files:
     *   if (!AlgorithmFramework.Find(x.name)) { RegisterAlgorithm(x); }
     * Matches regardless of unary negation, to also catch any positive-form
     * variants that might call AlgorithmFramework.Find(...) in the test.
     * @param {Object} testNode - The if-statement's test expression
     * @returns {boolean}
     */
    _isAlgorithmFrameworkFindGuard(testNode) {
      if (!testNode) return false;

      const isFindCall = (node) => {
        if (!node) return false;
        if (node.type === 'UnaryExpression' && node.operator === '!')
          return isFindCall(node.argument);
        if (node.type === 'CallExpression' &&
            node.callee?.type === 'MemberExpression' &&
            node.callee.object?.type === 'Identifier' &&
            node.callee.object.name === 'AlgorithmFramework' &&
            (node.callee.property?.name === 'Find' || node.callee.property?.value === 'Find'))
          return true;
        return false;
      };

      if (isFindCall(testNode)) return true;

      // Logical combination: !AlgorithmFramework.Find || !AlgorithmFramework.Find(...)
      if (testNode.type === 'LogicalExpression')
        return this._isAlgorithmFrameworkFindGuard(testNode.left) ||
               this._isAlgorithmFrameworkFindGuard(testNode.right);

      return false;
    }

    /**
     * Does this (pre-transform) node contain a RegisterAlgorithm(x) or
     * AlgorithmFramework.RegisterAlgorithm(x) call anywhere within it?
     * Used to recognize the "register if not already registered" guard
     * regardless of exactly how its condition is phrased - some files test
     * "!AlgorithmFramework.Find(name)" (see
     * _isAlgorithmFrameworkFindGuard), others just "AlgorithmFramework &&
     * AlgorithmFramework.RegisterAlgorithm" (a plain existence check) - any
     * top-level if wrapping a registration call must always be unwrapped
     * since there is no registry to query in standalone output.
     * @param {object} node
     * @returns {boolean}
     */
    /**
     * Is this node structurally known to be an object literal carrying a
     * "length" field (as opposed to an array/string whose .length is the
     * built-in element/character count)? See classLengthFieldMethods /
     * objectLengthVariables (populated by the class pre-scan and
     * transformLetStatement respectively).
     * @param {object} node
     * @returns {boolean}
     */
    _isLengthFieldObject(node) {
      if (!node) return false;
      if (node.type === 'Identifier' && this.objectLengthVariables.has(node.name))
        return true;
      if (node.type === 'ThisMethodCall' && this.currentClassName) {
        const flagged = this.classLengthFieldMethods.get(this.currentClassName);
        if (flagged && flagged.has(node.method)) return true;
      }
      // Same check, but for a direct (non-"this") method-call chain like
      // "hashTable.find(...).length" - see anyClassLengthFieldMethodNames'
      // doc comment for why this is a flat, receiver-unaware method-name
      // match instead of the current class's own registry.
      if (node.type === 'CallExpression' && node.callee?.type === 'MemberExpression' && !node.callee.computed) {
        const calledMethod = node.callee.property?.name || node.callee.property?.value;
        if (calledMethod && this.anyClassLengthFieldMethodNames && this.anyClassLengthFieldMethodNames.has(calledMethod))
          return true;
      }
      return false;
    }

    /**
     * Infer which of the given parameter names are structurally used as
     * strings within a function/method body - e.g. "name += 'x'",
     * "name === 'literal'", "name.charAt(i)" - since parameters carry no
     * JS type annotation the way "const x = <string-expr>" locals do (see
     * transformLetStatement). Does not descend into nested function/arrow
     * bodies (those have their own parameter scope).
     * @param {object} body - function body (BlockStatement)
     * @param {Set<string>} paramNames
     * @returns {Set<string>} subset of paramNames inferred to be strings
     */
    _inferStringParamsFromUsage(body, paramNames) {
      const found = new Set();
      const polymorphic = new Set();  // params reassigned or typeof-branched - too dynamic to trust
      const isParamRef = (n) => n && n.type === 'Identifier' && paramNames.has(n.name);
      const stringMethods = ['substring', 'substr', 'toUpperCase', 'toLowerCase', 'trim',
        'trimStart', 'trimEnd', 'charAt', 'charCodeAt', 'concat', 'repeat',
        'replace', 'replaceAll', 'padStart', 'padEnd', 'split'];

      // Is this an "if (typeof paramName === 'string') {...}" guard? Common
      // polymorphic-input idiom (Update(data) accepting a string OR a byte
      // array, normalizing to bytes inside the branch) - evidence of
      // string-only methods *inside* that branch says nothing about the
      // param's type in the (far more common) rest of the function, so its
      // consequent must not be scanned for string signals.
      const isTypeofStringGuard = (test) => {
        if (!test || test.type !== 'BinaryExpression') return false;
        if (!['===', '=='].includes(test.operator)) return false;
        const isTypeofParam = (n) => n && n.type === 'TypeOfExpression' && isParamRef(n.argument);
        const isStringLit = (n) => n && n.type === 'Literal' && n.value === 'string';
        return (isTypeofParam(test.left) && isStringLit(test.right)) ||
               (isTypeofParam(test.right) && isStringLit(test.left));
      };

      const visit = (node) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(visit); return; }

        // Don't cross into nested function/method scopes - different params
        if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression' ||
            node.type === 'ArrowFunction' || node.type === 'FunctionDeclaration')
          return;

        // Plain reassignment (paramName = ...) - a strong signal the param
        // is used polymorphically (e.g. normalized from string to byte
        // array), so don't trust any string-method evidence for it.
        if (node.type === 'AssignmentExpression' && node.operator === '=' && isParamRef(node.left))
          polymorphic.add(node.left.name);

        if (node.type === 'IfStatement' && isTypeofStringGuard(node.test)) {
          visit(node.alternate);  // still fine - covers the non-string branch
          return;  // skip node.consequent entirely
        }

        // paramName += <structurally-string-expr>
        if (node.type === 'AssignmentExpression' && node.operator === '+=' && isParamRef(node.left)) {
          if (this.isStringType(node.right)) found.add(node.left.name);
        }

        // paramName + <string-expr> / <string-expr> + paramName
        if ((node.type === 'BinaryExpression' || node.type === 'LogicalExpression') && node.operator === '+') {
          if (isParamRef(node.left) && this.isStringType(node.right)) found.add(node.left.name);
          if (isParamRef(node.right) && this.isStringType(node.left)) found.add(node.right.name);
        }

        // paramName === 'literal' / paramName !== 'literal' (either side)
        if (node.type === 'BinaryExpression' && ['===', '==', '!==', '!='].includes(node.operator)) {
          if (isParamRef(node.left) && node.right?.type === 'Literal' && typeof node.right.value === 'string') found.add(node.left.name);
          if (isParamRef(node.right) && node.left?.type === 'Literal' && typeof node.left.value === 'string') found.add(node.right.name);
        }

        // paramName.someStringMethod(...)
        if (node.type === 'CallExpression' && node.callee?.type === 'MemberExpression' && isParamRef(node.callee.object)) {
          const m = node.callee.property?.name || node.callee.property?.value;
          if (stringMethods.includes(m)) found.add(node.callee.object.name);
        }

        for (const key of Object.keys(node)) {
          if (key === 'parent' || key === '_parent') continue;
          visit(node[key]);
        }
      };
      visit(body);
      for (const name of polymorphic) found.delete(name);
      return found;
    }

    /**
     * Whole-file version of transformClassDeclaration's callSiteStringParams
     * cross-call-site inference, for plain top-level (module-scope)
     * "function foo(...) {...}" declarations instead of class methods. A
     * top-level helper's own body often gives no local string-ness signal
     * (e.g. kdf/bcrypt.js's "function bcryptBase64Decode(str) { ...
     * str.length ... str[i++] ... }" - both ambiguous between array and
     * string), but every actual call site in the same file passes it a
     * string literal (e.g. "bcryptBase64Decode(\"DfPyLs.G6...\")" inside a
     * module-level test-vector object) - exactly the same kind of evidence
     * callSiteStringParams already exploits for "this.method(...)" calls,
     * just for bare "foo(...)" calls to a top-level function instead.
     * Without this, "str[i++]" defaulted to array-element access
     * ("$str->[$i++]"), dying "Can't use string (...) as an ARRAY ref"
     * the moment a real string argument reached it.
     *
     * Single pass (no fixed-point loop): unlike the per-class version,
     * arguments here are overwhelmingly literals/simple expressions at the
     * call site, not forwarded same-named parameters of ANOTHER top-level
     * function chaining into this one - the extra passes there exist to
     * resolve exactly that chaining, which doesn't arise for this narrower
     * top-level-helper case in practice.
     * @param {object} jsAst - the whole-file AST
     * @returns {Map<string, Set<string>>} function name -> Set(parameter names)
     */
    _collectTopLevelFunctionStringParams(jsAst) {
      const funcParams = new Map();  // name -> [paramName, ...]
      const collectDecls = (node) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(collectDecls); return; }
        if (node.type === 'FunctionDeclaration' && node.id?.name) {
          const names = (node.params || []).map(p =>
            (p.type === 'AssignmentPattern' ? p.left.name : p.name)).filter(Boolean);
          funcParams.set(node.id.name, names);
        }
        for (const key of Object.keys(node)) {
          if (key === 'parent' || key === '_parent') continue;
          collectDecls(node[key]);
        }
      };
      collectDecls(jsAst);
      if (funcParams.size === 0) return new Map();

      const callArgsByName = new Map();  // name -> [args[], ...]
      const collectCalls = (node) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(collectCalls); return; }
        if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && funcParams.has(node.callee.name)) {
          if (!callArgsByName.has(node.callee.name)) callArgsByName.set(node.callee.name, []);
          callArgsByName.get(node.callee.name).push(node.arguments || []);
        }
        for (const key of Object.keys(node)) {
          if (key === 'parent' || key === '_parent') continue;
          collectCalls(node[key]);
        }
      };
      collectCalls(jsAst);

      const result = new Map();
      for (const [name, paramNames] of funcParams) {
        const calls = callArgsByName.get(name);
        if (!calls || calls.length === 0) continue;
        const stringParams = new Set();
        for (let i = 0; i < paramNames.length; ++i) {
          if (!paramNames[i]) continue;
          const allString = calls.every(args => args[i] && this.isStringType(args[i]));
          if (allString) stringParams.add(paramNames[i]);
        }
        if (stringParams.size > 0) result.set(name, stringParams);
      }
      return result;
    }

    /**
     * Whole-file prescan collecting local variable names whose initializer
     * is directly a String.prototype.split(...) call (the IL 'StringSplit'
     * node) - e.g. "const words = upperData.split(/\s+/);". See
     * stringSplitVarNames' doc comment (declared in the constructor) for
     * why this must be a direct structural check rather than trusting the
     * shared parser's own per-reference resultType annotation.
     * @param {object} jsAst
     * @returns {Set<string>}
     */
    _collectStringSplitVarNames(jsAst) {
      const names = new Set();
      const visit = (node) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(visit); return; }
        if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' &&
            node.init && node.init.type === 'StringSplit') {
          names.add(node.id.name);
        }
        for (const key of Object.keys(node)) {
          if (key === 'parent' || key === '_parent') continue;
          visit(node[key]);
        }
      };
      visit(jsAst);
      return names;
    }

    /**
     * Recursively collect every ReturnStatement node reachable within a
     * function/method body (without descending into nested function
     * expressions, whose returns belong to a different scope).
     * @param {object} node
     * @param {Array} out - accumulator array
     */
    _collectReturnStatements(node, out) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { for (const n of node) this._collectReturnStatements(n, out); return; }
      if (node.type === 'ReturnStatement') { out.push(node); return; }
      // Don't cross into nested function/method scopes
      if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression' ||
          node.type === 'ArrowFunction' || node.type === 'FunctionDeclaration')
        return;
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectReturnStatements(node[key], out);
      }
    }

    /**
     * Within a single function/method body (not crossing into nested
     * function scopes), collect the names of local variables that are ever
     * declared or reassigned to an object literal with a "length" property
     * (e.g. "let best = { distance, length };" declared once, then
     * "best = { distance: ..., length: ... };" reassigned inside a loop).
     * Used by the classLengthFieldMethods pre-scan so a method that builds
     * its {distance,length}-shaped return value across a loop and returns
     * the variable by name (rather than a literal "return { ... };") is
     * still recognized - see the call site's comment.
     * @param {object} node
     * @param {Set<string>} [out]
     * @returns {Set<string>}
     */
    _collectLengthFieldVarNames(node, out) {
      out = out || new Set();
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const n of node) this._collectLengthFieldVarNames(n, out);
        return out;
      }
      const isLengthFieldObjectExpr = (n) => n && (n.type === 'ObjectExpression' || n.type === 'ObjectLiteral') &&
        (n.properties || []).some(p => {
          const key = p.key;
          return (typeof key === 'string' ? key : (key?.name || key?.value)) === 'length';
        });
      if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' && isLengthFieldObjectExpr(node.init)) {
        out.add(node.id.name);
      }
      if (node.type === 'AssignmentExpression' && node.operator === '=' &&
          node.left?.type === 'Identifier' && isLengthFieldObjectExpr(node.right)) {
        out.add(node.left.name);
      }
      // Don't cross into nested function/method scopes
      if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression' ||
          node.type === 'ArrowFunction' || node.type === 'FunctionDeclaration')
        return out;
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectLengthFieldVarNames(node[key], out);
      }
      return out;
    }

    /**
     * Flat (all classes, no lexical/receiver scoping - same imprecision
     * trade-off as _collectArrayFieldNames et al.) whole-file version of the
     * per-class classLengthFieldMethods scan done inside
     * transformClassDeclaration: any method, in any class in the file,
     * whose return value is structurally a {..., length: ...}-shaped object
     * literal. classLengthFieldMethods only helps "this.method()" calls
     * (looked up by this.currentClassName, the class actually being
     * transformed right now) - it has nothing for "const match =
     * someOtherInstance.method(...);" where someOtherInstance is a
     * different class (e.g. a compression LZ77 HashTable's "find(...)"
     * returning a {distance, length} match record, called from the
     * Instance class's _compress()). Tracking each local variable's actual
     * constructed class type would be the precise fix but is a much bigger
     * lift; a flat method-name match is the same practical trade-off
     * already made for array/hash field-name inference.
     * @param {object} jsAst
     * @returns {Set<string>}
     */
    _collectAnyClassLengthFieldMethodNames(jsAst) {
      const out = new Set();
      const isLengthFieldObjectExpr = (n) => n && (n.type === 'ObjectExpression' || n.type === 'ObjectLiteral') &&
        (n.properties || []).some(p => {
          const key = p.key;
          return (typeof key === 'string' ? key : (key?.name || key?.value)) === 'length';
        });
      const walk = (node) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { for (const item of node) walk(item); return; }
        if (node.type === 'MethodDefinition' && node.kind !== 'get' && node.kind !== 'set' &&
            node.kind !== 'constructor' && node.key) {
          const returns = [];
          this._collectReturnStatements(node.value?.body, returns);
          const localLengthFieldVarNames = this._collectLengthFieldVarNames(node.value?.body);
          const hasLengthFieldReturn = returns.some(r =>
            r.argument && (isLengthFieldObjectExpr(r.argument) ||
              (r.argument.type === 'Identifier' && localLengthFieldVarNames.has(r.argument.name))));
          if (hasLengthFieldReturn) {
            const name = node.key.name || node.key.value;
            if (name) out.add(name);
          }
        }
        for (const key of Object.keys(node)) {
          if (key === 'parent' || key === '_parent') continue;
          walk(node[key]);
        }
      };
      walk(jsAst);
      return out;
    }

    /**
     * Flat whole-file scan (no lexical scoping, same imprecision trade-off
     * as _collectArrayFieldNames et al.) for local array variable names that
     * are ever pushed a {..., length: ...}-shaped object literal - e.g. LZ77
     * tokenizers: "tokens.push({ type: 'match', distance, length, literal
     * });". Used by transformForOfStatement() - see its call site's comment.
     * @param {object} node
     * @param {Set<string>} [out]
     * @returns {Set<string>}
     */
    _collectLengthFieldArrayVarNames(node, out) {
      out = out || new Set();
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const n of node) this._collectLengthFieldArrayVarNames(n, out);
        return out;
      }
      const isLengthFieldObjectExpr = (n) => n && (n.type === 'ObjectExpression' || n.type === 'ObjectLiteral') &&
        (n.properties || []).some(p => {
          const key = p.key;
          return (typeof key === 'string' ? key : (key?.name || key?.value)) === 'length';
        });
      // The shared type-aware parser pre-converts ".push(...)"/".unshift(...)"
      // calls into a dedicated 'ArrayAppend' IL node ({ array, value, values
      // }) rather than leaving them as a CallExpression - so a raw
      // CallExpression/MemberExpression check here would never match.
      if (node.type === 'ArrayAppend' && node.array?.type === 'Identifier' &&
          ((node.values || []).some(isLengthFieldObjectExpr) || isLengthFieldObjectExpr(node.value))) {
        out.add(node.array.name);
      }
      if (node.type === 'CallExpression' && node.callee?.type === 'MemberExpression' &&
          node.callee.object?.type === 'Identifier') {
        const methodName = node.callee.property?.name || node.callee.property?.value;
        if ((methodName === 'push' || methodName === 'unshift') &&
            (node.arguments || []).some(isLengthFieldObjectExpr)) {
          out.add(node.callee.object.name);
        }
      }
      if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' &&
          node.init && (node.init.type === 'ArrayExpression') &&
          (node.init.elements || []).some(isLengthFieldObjectExpr)) {
        out.add(node.id.name);
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectLengthFieldArrayVarNames(node[key], out);
      }
      return out;
    }

    /**
     * Flat whole-file scan for local variable names declared/reassigned
     * directly from a node of the given IL type (e.g. 'MapCreation',
     * 'SetCreation') - see mapVarNames/setVarNames' call site comment.
     * Also matches "const x = this.someHelper();"/"const x =
     * someHelper();" where someHelper is in methodNamesReturningType (see
     * _collectTypedReturningMethodNames) - e.g. "const contextOffsets =
     * this._initializeContextTables();" where that helper's own body is
     * "const t = new Map(); return t;" rather than a bare "return new Map();".
     * @param {object} node
     * @param {string} ilType
     * @param {Set<string>} [methodNamesReturningType]
     * @param {Set<string>} [out]
     * @returns {Set<string>}
     */
    _collectTypedVarNames(node, ilType, methodNamesReturningType, out) {
      if (methodNamesReturningType instanceof Set === false && methodNamesReturningType !== undefined) {
        // Called with the older 3-arg form (node, ilType, out) - shift args.
        out = methodNamesReturningType;
        methodNamesReturningType = undefined;
      }
      out = out || new Set();
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const n of node) this._collectTypedVarNames(n, ilType, methodNamesReturningType, out);
        return out;
      }
      const initReturnsType = (init) => init && (init.type === ilType ||
        (methodNamesReturningType && (init.type === 'ThisMethodCall' || init.type === 'CallExpression') &&
          methodNamesReturningType.has(init.method || init.callee?.name || init.callee?.property?.name)));
      if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' && initReturnsType(node.init)) {
        out.add(node.id.name);
      }
      if (node.type === 'AssignmentExpression' && node.operator === '=' &&
          node.left?.type === 'Identifier' && initReturnsType(node.right)) {
        out.add(node.left.name);
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectTypedVarNames(node[key], ilType, methodNamesReturningType, out);
      }
      return out;
    }

    /**
     * Flat whole-file scan for method/function names whose return
     * statement(s) yield a node of the given IL type (e.g. 'MapCreation'),
     * directly or via a local variable built up from one within the same
     * body (e.g. "_initializeContextTables() { const t = new Map(); return
     * t; }"). Feeds _collectTypedVarNames's methodNamesReturningType param.
     * @param {object} node
     * @param {string} ilType
     * @param {Set<string>} [out]
     * @returns {Set<string>}
     */
    _collectTypedReturningMethodNames(node, ilType, out) {
      out = out || new Set();
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const n of node) this._collectTypedReturningMethodNames(n, ilType, out);
        return out;
      }
      if ((node.type === 'MethodDefinition' || node.type === 'FunctionDeclaration') &&
          node.kind !== 'get' && node.kind !== 'set' && node.kind !== 'constructor') {
        const body = node.value?.body || node.body;
        const returns = [];
        this._collectReturnStatements(body, returns);
        const localTypedVarNames = this._collectTypedVarNames(body, ilType);
        const hasTypedReturn = returns.some(r => r.argument &&
          (r.argument.type === ilType || (r.argument.type === 'Identifier' && localTypedVarNames.has(r.argument.name))));
        const name = node.key?.name || node.id?.name;
        if (hasTypedReturn && name) out.add(name);
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectTypedReturningMethodNames(node[key], ilType, out);
      }
      return out;
    }

    /**
     * Same as _collectTypedVarNames but for "this.field = new Map()"/"new
     * Set()" style class-field initializations (ThisPropertyAccess or a
     * non-computed "this.X" MemberExpression on the left).
     * @param {object} node
     * @param {string} ilType
     * @param {Set<string>} [out]
     * @returns {Set<string>}
     */
    _collectTypedFieldNames(node, ilType, out) {
      out = out || new Set();
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const n of node) this._collectTypedFieldNames(n, ilType, out);
        return out;
      }
      if (node.type === 'AssignmentExpression' && node.operator === '=' && node.right?.type === ilType) {
        const left = node.left;
        if (left?.type === 'ThisPropertyAccess') {
          const fieldName = typeof left.property === 'string' ? left.property : (left.property?.name || left.property?.value);
          if (fieldName) out.add(fieldName);
        } else if (left?.type === 'MemberExpression' && !left.computed && left.object?.type === 'ThisExpression') {
          const fieldName = left.property?.name || left.property?.value;
          if (fieldName) out.add(fieldName);
        }
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectTypedFieldNames(node[key], ilType, out);
      }
      return out;
    }

    /**
     * Flat whole-file scan for every "static FIELD = ...;" class field name
     * (FieldDefinition with static:true, any class) - see staticFieldNames'
     * call site comment in transformMemberExpression's isClassObj dataProps
     * check.
     * @param {object} node
     * @param {Set<string>} [out]
     * @returns {Set<string>}
     */
    _collectStaticFieldNames(node, out) {
      out = out || new Set();
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const n of node) this._collectStaticFieldNames(n, out);
        return out;
      }
      if (node.type === 'FieldDefinition' && node.static === true) {
        const name = typeof node.key === 'string' ? node.key : (node.key?.name || node.key?.value);
        if (name) out.add(name);
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectStaticFieldNames(node[key], out);
      }
      return out;
    }

    /**
     * Flat whole-file scan for every "static get NAME() { ... }" class
     * getter-accessor name (MethodDefinition with kind:'get' and
     * static:true, any class) - e.g. block/rc.js's RC6Algorithm class's
     * "static get ROUNDS() { return 20; }"/"static get KEY_SCHEDULE_SIZE()
     * { return 44; }". See this set's use at transformMemberExpression's
     * isClassObj check: _isClassStaticField's `dataProps` fallback set
     * hardcodes a handful of common constant-ish names (including 'ROUNDS'
     * and 'KEY_SCHEDULE_SIZE' themselves, for the many OTHER ciphers in
     * this codebase that declare them as real "static FIELD = value;"
     * fields) - RC6Algorithm's cross-class reads of these two ("RC6Algorithm.
     * KEY_SCHEDULE_SIZE" from RC6Instance) matched that same hardcoded name
     * and got routed to the package-*variable* read "$RC6Algorithm::
     * KEY_SCHEDULE_SIZE" instead, which nothing ever populates for a getter
     * (only transformAccessorPair's combined `sub NAME {...}` does) -
     * silently `undef`, corrupting every downstream use ("Use of
     * uninitialized value ... in repeat (x)"/"numeric lt"/...). A name
     * actually declared as a static GETTER in this file must always win
     * over the hardcoded dataProps guess and be read via a method call
     * instead, regardless of what dataProps says.
     * @param {object} node
     * @param {Set<string>} [out]
     * @returns {Set<string>}
     */
    _collectStaticGetterNames(node, out) {
      out = out || new Set();
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const n of node) this._collectStaticGetterNames(n, out);
        return out;
      }
      if (node.type === 'MethodDefinition' && node.kind === 'get' && node.static === true) {
        const name = node.key?.name || node.key?.value;
        if (name) out.add(name);
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectStaticGetterNames(node[key], out);
      }
      return out;
    }

    /**
     * Flat whole-file scan for object-literal ("ObjectProperty" IL node,
     * from a plain "{ ... }" ObjectExpression) property names whose value is
     * a code reference - either a shorthand/aliased reference to a
     * top-level function name (topLevelFunctionNames, e.g. "{ piMix, phi0,
     * phi1, gammaTau }" in block/crypton.js's CryptonTables IIFE, each name
     * a locally-scoped arrow-function const) or an inline
     * Function/ArrowFunctionExpression value.
     *
     * Needed because a later "someObj.piMix(...)" call - where someObj is
     * some plain (unblessed) data hashref threaded through several layers
     * of property access (e.g. crypton.js's "this.algorithm.tables.gammaTau(...)")
     * - is NOT a real Perl method call; the property holds a coderef
     * (transformObjectExpression/the object-literal-to-hashref emission
     * stores it as "'gammaTau' => \&main::gammaTau"), so it must be invoked
     * as "$obj->{'gammaTau'}->(...)" (hash-key deref-call), never
     * "$obj->gammaTau(...)" (real method dispatch, which dies "Can't call
     * method ... on unblessed reference" since the hashref is never
     * blessed into a package) - see transformCallExpression's generic
     * "obj.method(args)" fallback, which checks this set first.
     * @param {object} node
     * @param {Set<string>} topLevelFunctionNames
     * @param {Set<string>} [out]
     * @returns {Set<string>}
     */
    _collectObjectCoderefPropNames(node, topLevelFunctionNames, out) {
      out = out || new Set();
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const n of node) this._collectObjectCoderefPropNames(n, topLevelFunctionNames, out);
        return out;
      }
      if (node.type === 'ObjectProperty' && !node.computed && typeof node.key === 'string') {
        const v = node.value;
        // Deliberately NOT matching an inline Function/ArrowFunctionExpression
        // value here ("name: function() {...}"/"name: (...) => ...") - that
        // shape is exactly how this codebase's pervasive "legacy algorithm
        // object literal" pattern declares its instance methods (e.g.
        // hash/siphash.js's "Init: function() { this.key = ...; }"), which
        // gets bless()ed into _LegacyAlgoObj and dispatches
        // "instance.Init()"/"$instance->Init()" through that package's
        // AUTOLOAD (see PerlEmitter.js's emitLegacyAlgoObjStub), which
        // already correctly passes $self as the first argument. Treating
        // that same property name as a bare coderef here would instead
        // rewrite the call to "$instance->{'Init'}->()" - bypassing AUTOLOAD
        // and its self-passing entirely, dying "Too few arguments for
        // subroutine ... (got 0; expected 1)". Only a shorthand/aliased
        // reference to an already-declared top-level function (e.g.
        // block/crypton.js's "{ piMix, phi0, phi1, gammaTau }", each name a
        // locally-scoped arrow-function const, never blessed into anything)
        // is unambiguous enough to treat as a plain coderef property.
        const isFuncRef = v && v.type === 'Identifier' && topLevelFunctionNames.has(v.name);
        if (isFuncRef) out.add(node.key);
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectObjectCoderefPropNames(node[key], topLevelFunctionNames, out);
      }
      return out;
    }

    /**
     * Flat whole-file scan for every class method name (any MethodDefinition
     * key, in any class) - used to keep objectCoderefPropNames from
     * misfiring on a name that ALSO happens to be a real method somewhere in
     * the same file (e.g. a class defining its own "update"/"compress"
     * method while an unrelated object literal elsewhere in the file
     * shorthand-exposes an unrelated same-named local helper function). A
     * real method call always wins - see objectCoderefPropNames' call site,
     * which subtracts this set.
     * @param {object} node
     * @param {Set<string>} [out]
     * @returns {Set<string>}
     */
    _collectClassMethodNames(node, out) {
      out = out || new Set();
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const n of node) this._collectClassMethodNames(n, out);
        return out;
      }
      if (node.type === 'MethodDefinition' && node.kind !== 'constructor') {
        const name = node.key?.name || node.key?.value;
        if (name) out.add(name);
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectClassMethodNames(node[key], out);
      }
      return out;
    }

    /**
     * Same flat whole-file MethodDefinition scan as _collectClassMethodNames,
     * but restricted to kind === 'method' (excludes 'get'/'set' accessor
     * pairs) - used by the 'ThisPropertyAccess' bare-method-value-reference
     * case (transformExpression) and transformCallExpression's ".call(
     * thisArg, ...)" handling, which must NOT fire for an ordinary
     * accessor-backed property (this.outputSize/this.key/...) just because
     * SOME unrelated class elsewhere in the same file happens to define a
     * "get outputSize()"/"set outputSize()" pair sharing that name -
     * _collectClassMethodNames' broader set (deliberately including
     * accessors, for its own different objectCoderefPropNames purpose)
     * caused exactly that false positive: a plain "this.outputSize = 32;"
     * field WRITE was rewritten to the nonsensical, non-assignable
     * "$self->can('outputSize') = 32;" ("Can't modify non-lvalue
     * subroutine call") wherever the file happened to bundle/reference a
     * same-named accessor from another class. A real bare-method-reference
     * (hash/haval.js's "this.fp3_1", .../zpaq.js's "this._deltaTransform")
     * is always a genuine callable method (kind 'method'), never a get/set
     * pair, so restricting to 'method' loses no legitimate case.
     * @param {object} node
     * @param {Set<string>} [out]
     * @returns {Set<string>}
     */
    _collectPlainClassMethodNames(node, out) {
      out = out || new Set();
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const n of node) this._collectPlainClassMethodNames(n, out);
        return out;
      }
      if (node.type === 'MethodDefinition' && node.kind === 'method') {
        const name = node.key?.name || node.key?.value;
        if (name) out.add(name);
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectPlainClassMethodNames(node[key], out);
      }
      return out;
    }

    /**
     * Flat whole-file scan for top-level function-like declaration names:
     * "function name(...) {...}" (FunctionDeclaration) and "const/let name =
     * (...) => {...}"/"function(...) {...}" (VariableDeclarator whose init
     * is a Function/ArrowFunctionExpression). Feeds _collectCodeRefFieldNames -
     * see its call site comment (codeRefFieldNames).
     * @param {object} node
     * @param {Set<string>} [out]
     * @returns {Set<string>}
     */
    _collectTopLevelFunctionNames(node, out) {
      out = out || new Set();
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const n of node) this._collectTopLevelFunctionNames(n, out);
        return out;
      }
      if (node.type === 'FunctionDeclaration' && node.id?.name) {
        out.add(node.id.name);
      }
      if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' && node.init &&
          (node.init.type === 'FunctionExpression' || node.init.type === 'ArrowFunctionExpression' || node.init.type === 'ArrowFunction')) {
        out.add(node.id.name);
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectTopLevelFunctionNames(node[key], out);
      }
      return out;
    }

    /**
     * Flat whole-file scan for "this.field = someFunctionName;" - a field
     * assigned a bare reference to a top-level helper function (see
     * codeRefFieldNames' call site comment). "someFunctionName" must be one
     * of the names _collectTopLevelFunctionNames found - a bare Identifier
     * RHS by itself is ambiguous (could just as easily be aliasing another
     * data field), so this only fires for the specific, unambiguous
     * function-reference-assignment shape.
     *
     * Also matches "this.field = (a) => expr;"/"this.field = function(a)
     * {...};" - a field assigned an INLINE closure directly, e.g.
     * block/mars.js's constructor "this.S0 = (a) => this.Sbox[a & 0xFF];"
     * (a per-instance memoized S-box accessor), later called as
     * "this.S0(a)". Unlike the bare-Identifier case above this is
     * unambiguous on its own (an arrow/function-expression RHS can only
     * ever be a code reference), so no topLevelFunctionNames cross-check is
     * needed. Missing this made every "this.S0(a)"-style call fall through
     * to a normal method-call emission ("$self->S0($a)"), which died
     * "Can't locate object method S0 via package MARSInstance" (S0 is a
     * field holding a coderef, not a real class method).
     * @param {object} node
     * @param {Set<string>} topLevelFunctionNames
     * @param {Set<string>} [out]
     * @returns {Set<string>}
     */
    _collectCodeRefFieldNames(node, topLevelFunctionNames, out) {
      out = out || new Set();
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const n of node) this._collectCodeRefFieldNames(n, topLevelFunctionNames, out);
        return out;
      }
      const isDirectClosure = node.right && (node.right.type === 'ArrowFunctionExpression' ||
        node.right.type === 'ArrowFunction' || node.right.type === 'FunctionExpression');
      if (node.type === 'AssignmentExpression' && node.operator === '=' &&
          ((node.right?.type === 'Identifier' && topLevelFunctionNames.has(node.right.name)) || isDirectClosure)) {
        const left = node.left;
        const isThisProp = left && (left.type === 'ThisPropertyAccess' ||
          (left.type === 'MemberExpression' && !left.computed && left.object?.type === 'ThisExpression'));
        if (isThisProp) {
          const fieldName = typeof left.property === 'string' ? left.property : (left.property?.name || left.property?.value);
          if (fieldName) out.add(fieldName);
        }
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectCodeRefFieldNames(node[key], topLevelFunctionNames, out);
      }
      return out;
    }

    /**
     * Flat whole-file scan for "this.field = <arrayExpr>.map(() => new
     * Set())"-shaped field initializations (array of Sets - see
     * setArrayFieldNames' call site comment). Only the callback's return
     * value matters, so the array expression being mapped over (ArrayFill,
     * ArrayCreation, a literal, ...) is deliberately not inspected.
     * @param {object} node
     * @param {Set<string>} [out]
     * @returns {Set<string>}
     */
    _collectSetArrayFieldNames(node, out) {
      out = out || new Set();
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const n of node) this._collectSetArrayFieldNames(n, out);
        return out;
      }
      if (node.type === 'AssignmentExpression' && node.operator === '=' &&
          node.left?.type === 'ThisPropertyAccess' && !node.left.computed &&
          node.right?.type === 'ArrayMap') {
        const cb = node.right.callback;
        const cbBody = cb && (cb.type === 'ArrowFunction' || cb.type === 'ArrowFunctionExpression' || cb.type === 'FunctionExpression') ? cb.body : null;
        const isSetReturn = cbBody && (cbBody.type === 'SetCreation' ||
          (cbBody.type === 'BlockStatement' && (cbBody.body || []).some(s => s.type === 'ReturnStatement' && s.argument?.type === 'SetCreation')));
        if (isSetReturn) {
          const fieldName = typeof node.left.property === 'string' ? node.left.property : (node.left.property?.name || node.left.property?.value);
          if (fieldName) out.add(fieldName);
        }
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectSetArrayFieldNames(node[key], out);
      }
      return out;
    }

    /**
     * Flat whole-file scan for "this.field.set(key, new Set())" call sites
     * (Map whose values are Sets - see mapOfSetFieldNames' call site
     * comment). Doesn't require the field to already be a known Map field
     * (a plain hashref field populated this way needs the same rewriting).
     * @param {object} node
     * @param {Set<string>} [out]
     * @returns {Set<string>}
     */
    _collectMapOfSetFieldNames(node, out) {
      out = out || new Set();
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const n of node) this._collectMapOfSetFieldNames(n, out);
        return out;
      }
      if (node.type === 'CallExpression' && node.callee?.type === 'MemberExpression' && !node.callee.computed &&
          node.callee.object?.type === 'ThisPropertyAccess' &&
          (node.callee.property?.name || node.callee.property?.value) === 'set' &&
          (node.arguments || [])[1]?.type === 'SetCreation') {
        const fieldName = typeof node.callee.object.property === 'string' ? node.callee.object.property : (node.callee.object.property?.name || node.callee.object.property?.value);
        if (fieldName) out.add(fieldName);
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectMapOfSetFieldNames(node[key], out);
      }
      return out;
    }

    /**
     * Counts capturing groups in a (JS-flavored) regex pattern source, for
     * the transformCallExpression '.match()' handler, which needs to know
     * how many $1/$2/... vars to read out. Skips escaped parens, character
     * classes (parens inside "[...]" aren't grouping constructs), and
     * non-capturing/lookaround groups ("(?:", "(?=", "(?!", "(?<=", "(?<!"),
     * but counts named capture groups ("(?<name>...)": Perl still assigns
     * them a positional $N alongside the name).
     * @param {string} pattern
     * @returns {number}
     */
    _countRegexCaptureGroups(pattern) {
      let count = 0;
      for (let i = 0; i < pattern.length; i++) {
        const c = pattern[i];
        if (c === '\\') { i++; continue; }
        if (c === '[') {
          i++;
          if (pattern[i] === ']') i++; // a leading ']' inside a class is literal
          while (i < pattern.length && pattern[i] !== ']') {
            if (pattern[i] === '\\') i++;
            i++;
          }
          continue;
        }
        if (c === '(') {
          if (pattern[i + 1] === '?') {
            // (?<name>...) is a capturing named group; (?:, (?=, (?!, (?<=,
            // (?<! are not.
            if (pattern[i + 2] === '<' && pattern[i + 3] !== '=' && pattern[i + 3] !== '!') count++;
          } else {
            count++;
          }
        }
      }
      return count;
    }

    _containsRegisterAlgorithmCall(node) {
      if (!node || typeof node !== 'object') return false;
      if (Array.isArray(node)) return node.some(n => this._containsRegisterAlgorithmCall(n));
      if (node.type === 'CallExpression') {
        if (node.callee?.type === 'Identifier' && node.callee.name === 'RegisterAlgorithm') return true;
        // Match ...AlgorithmFramework.RegisterAlgorithm(x) regardless of how
        // deeply the object reference is nested (e.g. plain
        // "AlgorithmFramework.RegisterAlgorithm" or the more common
        // "global.AlgorithmFramework.RegisterAlgorithm") - only the final
        // ".RegisterAlgorithm" property name actually matters here.
        if (node.callee?.type === 'MemberExpression' &&
            (node.callee.property?.name === 'RegisterAlgorithm' || node.callee.property?.value === 'RegisterAlgorithm'))
          return true;
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        if (this._containsRegisterAlgorithmCall(node[key])) return true;
      }
      return false;
    }

    /**
     * Generate stub packages for framework base classes
     * @returns {PerlClass[]} Array of stub class definitions
     */
    _generateFrameworkStubs() {
      const stubs = [];
      for (const className of this.frameworkClasses) {
        const stubClass = new PerlClass(className);
        // Add simple new() constructor that returns blessed hashref
        const newMethod = new PerlSub('new');
        newMethod.body = new PerlBlock();
        newMethod.body.statements.push(
          new PerlRawCode('my $class = shift;'),
          new PerlRawCode('my $self = { @_ };'),
          new PerlRawCode('bless $self, $class;'),
          new PerlRawCode('return $self;')
        );
        stubClass.methods.push(newMethod);
        stubs.push(stubClass);
      }
      return stubs;
    }

    /**
     * Transform a top-level JavaScript node
     */
    transformTopLevel(node, targetModule) {
      switch (node.type) {
        case 'VariableDeclaration':
          this.transformVariableDeclaration(node, targetModule);
          break;

        case 'FunctionDeclaration':
          this.transformFunctionDeclaration(node, targetModule);
          break;

        case 'ClassDeclaration':
          this.transformClassDeclaration(node, targetModule);
          break;

        case 'ExpressionStatement':
          // Handle IIFE wrappers - extract content from inside
          if (node.expression.type === 'CallExpression') {
            const callee = node.expression.callee;
            if (callee.type === 'FunctionExpression' ||
                callee.type === 'ArrowFunctionExpression' || callee.type === 'ArrowFunction') {
              // Extract and process IIFE body content
              this.transformIIFEContent(callee, node.expression, targetModule);
              break;
            }
          }
          // Handle regular expression statements (including ArrayForEach)
          {
            const stmt = this.transformExpressionStatementNode(node);
            if (stmt) {
              targetModule.statements.push(stmt);
            }
          }
          break;

        case 'IfStatement':
          // Most top-level ifs are module-loading guards (e.g. "if
          // (!AlgorithmFramework) { ... require ... }") that make no sense
          // in standalone transpiled output and are safely dropped.
          //
          // The one guard that must NOT be dropped is the duplicate-
          // registration check that wraps every RegisterAlgorithm() call:
          //   if (!AlgorithmFramework.Find(x.name)) { RegisterAlgorithm(x); }
          // There is no registry to query in standalone output, so the
          // condition is always true there - unwrap it and emit the
          // consequent unconditionally so registration actually happens.
          if (this._isAlgorithmFrameworkFindGuard(node.test) || this._containsRegisterAlgorithmCall(node.consequent)) {
            const body = node.consequent?.type === 'BlockStatement'
              ? node.consequent.body
              : (node.consequent ? [node.consequent] : []);
            for (const inner of body) {
              this.transformTopLevel(inner, targetModule);
            }
          }
          break;

        // Top-level loops - see the matching case in transformIIFEContent
        // for why this matters (multi-variant "for (variant of [...])
        // RegisterAlgorithm(...)" registration loops).
        case 'ForStatement':
        case 'ForOfStatement':
        case 'ForInStatement':
        case 'WhileStatement':
        case 'DoWhileStatement': {
          const transformed = this.transformStatement(node);
          if (transformed) targetModule.statements.push(transformed);
          break;
        }

        // Top-level "try { ... } catch (e) { ... }" - notably
        // stream/pike.js's registration guard:
        //   if (global.AlgorithmFramework && typeof global.AlgorithmFramework.
        //       RegisterAlgorithm === 'function') {
        //     try { global.AlgorithmFramework.RegisterAlgorithm(PIKE); }
        //     catch (e) { console.error(...); }
        //   }
        // The IfStatement case just above unwraps the outer guard (since
        // _containsRegisterAlgorithmCall matches through the nested try
        // block fine) and recurses into its single consequent statement -
        // here, a TryStatement, not a bare ExpressionStatement - via this
        // same transformTopLevel switch. Without a case for it, the
        // "default: skip" branch silently dropped the only
        // RegisterAlgorithm() call in the file, producing standalone
        // output with an empty @_registered_algorithms ("no registered
        // algorithm instance"). Standalone transpiled output has no
        // require()/global-object machinery left for the try to genuinely
        // guard against, so - mirroring the IfStatement case's own
        // "condition is always true in standalone output, unwrap
        // unconditionally" rationale - just emit the try block's
        // statements directly and drop the catch (a real failure should
        // surface as a die, not be silently swallowed).
        case 'TryStatement': {
          const body = node.block?.body || [];
          for (const inner of body) {
            this.transformTopLevel(inner, targetModule);
          }
          break;
        }

        default:
          // Skip unhandled top-level node types
          break;
      }
    }

    /**
     * Extract and transform content from IIFE wrapper
     */
    transformIIFEContent(calleeNode, callExpr, targetModule) {
      let bodyStatements = [];

      // First, try to find the factory function in UMD pattern
      if (callExpr && callExpr.arguments && callExpr.arguments.length >= 2) {
        const factoryArg = callExpr.arguments[1];
        if (factoryArg.type === 'FunctionExpression' || factoryArg.type === 'ArrowFunctionExpression' || factoryArg.type === 'ArrowFunction') {
          bodyStatements = factoryArg.body?.body || [];
        }
      }

      // Simple IIFE pattern: extract from callee's body
      if (bodyStatements.length === 0 && calleeNode.body && calleeNode.body.body) {
        bodyStatements = calleeNode.body.body;
      }

      // Process statements
      for (const stmt of bodyStatements) {
        // Skip the 'use strict' directive literal, but keep other expression
        // statements - notably bare RegisterAlgorithm(new X()) calls, which
        // are how many algorithm files register themselves without an
        // intermediate variable.
        if (stmt.type === 'ExpressionStatement') {
          if (stmt.expression?.type === 'Literal' && stmt.expression.value === 'use strict')
            continue;
          const transformed = this.transformExpressionStatementNode(stmt);
          if (transformed) targetModule.statements.push(transformed);
          continue;
        }

        // Process class declarations
        if (stmt.type === 'ClassDeclaration') {
          this.transformClassDeclaration(stmt, targetModule);
          continue;
        }

        // Process function declarations
        if (stmt.type === 'FunctionDeclaration') {
          this.transformFunctionDeclaration(stmt, targetModule);
          continue;
        }

        // Process variable declarations (const/let/var)
        if (stmt.type === 'VariableDeclaration') {
          this.transformVariableDeclaration(stmt, targetModule);
          continue;
        }

        // Most if-statements here are module-loading guards and are safely
        // dropped, except the duplicate-registration guard that wraps
        // RegisterAlgorithm() calls - unwrap that one so registration
        // actually happens in standalone output (see transformTopLevel).
        if (stmt.type === 'IfStatement') {
          // Also unwrap the plain-existence-check guard variant many legacy
          // "const X = {...}" files use instead of AlgorithmFramework.Find():
          //   if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
          //     global.AlgorithmFramework.RegisterAlgorithm(X);
          //   }
          // (see siphash.js/xxhash.js) - mirrors the top-level IfStatement
          // case in transformTopLevel, which already checks both guard forms.
          if (this._isAlgorithmFrameworkFindGuard(stmt.test) || this._containsRegisterAlgorithmCall(stmt.consequent)) {
            const body = stmt.consequent?.type === 'BlockStatement'
              ? stmt.consequent.body
              : (stmt.consequent ? [stmt.consequent] : []);
            for (const inner of body) {
              this.transformTopLevel(inner, targetModule);
            }
          }
          continue;
        }

        // Top-level loops - notably the "register every variant" pattern
        // several multi-variant algorithm files use instead of one bare
        // RegisterAlgorithm(x) call, e.g.:
        //   for (const variant of ['224','256','384','512']) {
        //     const inst = new SHA3Algorithm(variant);
        //     if (!AlgorithmFramework.Find(inst.name)) RegisterAlgorithm(inst);
        //   }
        // Previously silently dropped (no case matched), so none of the
        // variants ever got registered and the test harness found nothing
        // in @_registered_algorithms ("no registered algorithm instance").
        // transformStatement already knows how to lower these loop forms
        // for use inside method bodies - reuse it here for top-level use.
        if (stmt.type === 'ForStatement' || stmt.type === 'ForOfStatement' ||
            stmt.type === 'ForInStatement' || stmt.type === 'WhileStatement' ||
            stmt.type === 'DoWhileStatement') {
          const transformed = this.transformStatement(stmt);
          if (transformed) targetModule.statements.push(transformed);
          continue;
        }
      }
    }

    /**
     * Build the statement(s) for a top-level (module-scope) JS "const/let"
     * declaration - e.g. a hash algorithm's "const K = [0x428a2f98, ...];"
     * round-constant table declared outside any class.
     *
     * Uses 'my' (a file-lexical), not 'our' (a package-global aliased to
     * the *current* package at the point of declaration). Two independent
     * problems with 'our' here, both only visible once more than one
     * transpiled algorithm file ends up concatenated into a single Perl
     * process (exactly what measure_pl.js's dependency-bundling mode does
     * for AEAD/mode-over-cipher and KDF-over-hash test vectors):
     *   1. A same-named top-level constant in two different bundled files
     *      (e.g. both SHA-1 and SHA-256 name their round-constant table
     *      "K") both declare "our $K" while "package main" is current,
     *      i.e. the *same* package-global $main::K - the second file's
     *      assignment silently clobbers the first's, corrupting whichever
     *      algorithm's methods run afterward (this is exactly why bundled
     *      SHA-1+SHA-256 produced consistently wrong digests for *both*).
     *   2. Even a single file's own "our $K" (declared while "package
     *      main" is current, before the class's own "package Foo;" block
     *      starts) isn't visible as a bare "$K" from inside that class's
     *      methods without a redundant "our $K;" re-declaration in that
     *      package too - "package" switches which symbol table a bareword
     *      binds to, "our" ties the alias to whatever package was active
     *      at the declaration site, not every package that reads it later.
     * A file-lexical "my" has neither problem: it's visible to every
     * "package" block later in the *same file* (package boundaries don't
     * end a lexical scope), and concatenating multiple files together
     * gives each file's own "my $K" a genuinely separate variable, so an
     * later file's declaration can no longer overwrite an earlier file's.
     *
     * Split into a bare "my $name;" declaration followed by a separate
     * "$name = <init>;" assignment (mirroring emitVarDeclaration's existing
     * split for 'our' declarations with an initializer) so a
     * self-referential initializer (a recursive IIFE assigned to the same
     * name) can still see its own name in scope while evaluating.
     */
    _pushModuleConstant(targetModule, name, sigil, initializerNode) {
      targetModule.statements.push(new PerlVarDeclaration('my', name, sigil, null));
      targetModule.statements.push(new PerlExpressionStatement(
        new PerlAssignment(new PerlIdentifier(name, sigil), '=', initializerNode)
      ));
    }

    /**
     * Transform a variable declaration
     */
    transformVariableDeclaration(node, targetModule) {
      for (const decl of node.declarations) {
        if (!decl.init) continue;

        // Skip object destructuring
        if (decl.id.type === 'ObjectPattern')
          continue;

        // Handle array destructuring: const [a, b, c] = arr;
        // Perl supports list assignment: my ($a, $b, $c) = @arr;
        if (decl.id.type === 'ArrayPattern') {
          const sourceExpr = decl.init ? this.transformExpression(decl.init) : null;
          if (sourceExpr) {
            for (let i = 0; i < decl.id.elements.length; ++i) {
              const elem = decl.id.elements[i];
              if (!elem) continue; // Skip holes in destructuring

              const varName = elem.name;
              const indexExpr = new PerlSubscript(sourceExpr, PerlLiteral.Number(i));
              this._pushModuleConstant(targetModule, varName, '$', indexExpr);
            }
          }
          continue;
        }

        const name = decl.id.name;

        // Skip framework module loading patterns like:
        // const AlgorithmFramework = global.AlgorithmFramework
        // const OpCodes = global.OpCodes
        // These are provided by the test harness
        if (decl.init.type === 'MemberExpression' &&
            decl.init.object.type === 'Identifier' &&
            (decl.init.object.name === 'global' || decl.init.object.name === 'globalThis')) {
          const member = decl.init.property.name || decl.init.property.value;
          if (member === 'AlgorithmFramework' || member === 'OpCodes')
            continue;
        }

        // Check if this is an object literal defining a module/struct
        if (decl.init.type === 'ObjectExpression') {
          // Store as hash reference ($hash = {...}) for consistent access with $hash->{key}
          // Register the variable type so subsequent uses get the correct sigil
          this.registerVariableType(name, '$');
          this._pushModuleConstant(targetModule, name, '$', this.transformExpression(decl.init));
        }
        // Check if this is an IIFE
        else if (decl.init.type === 'CallExpression' &&
                 (decl.init.callee.type === 'FunctionExpression' ||
                  decl.init.callee.type === 'ArrowFunctionExpression' || decl.init.callee.type === 'ArrowFunction')) {
          // IIFE - transform as do { } block to preserve internal functions
          if (this.options.debug) console.log('DEBUG: Found IIFE for', name);
          const iifeFunc = decl.init.callee;
          if (iifeFunc.body && iifeFunc.body.type === 'BlockStatement' && iifeFunc.body.body) {
            const doBlock = new PerlBlock();

            // Transform all statements in the IIFE body
            for (const stmt of iifeFunc.body.body) {
              // Convert local function declarations to local subs
              if (stmt.type === 'FunctionDeclaration') {
                const funcName = stmt.id.name;
                const func = new PerlSub(funcName);
                func.useSignatures = this.options.addSignatures;

                // Parameters
                if (stmt.params) {
                  for (const param of stmt.params) {
                    let paramName, defaultValue = null;
                    if (param.type === 'AssignmentPattern') {
                      paramName = param.left.name;
                      defaultValue = this.transformExpression(param.right);
                    } else if (param.defaultValue) {
                      paramName = param.name;
                      defaultValue = this.transformExpression(param.defaultValue);
                    } else {
                      paramName = param.name;
                      // JS allows calling with fewer args than declared (missing ones become undefined);
                      // Perl signatures require an explicit default to permit that.
                      defaultValue = PerlLiteral.Undef();
                    }
                    func.parameters.push(new PerlParameter(paramName, '$', null, defaultValue));
                    this.registerVariableType(paramName, '$');
                  }
                }

                // Body
                if (stmt.body) {
                  func.body = this.transformBlockStatement(stmt.body);
                }

                doBlock.statements.push(func);
              }
              // Variable declarations become my declarations
              else if (stmt.type === 'VariableDeclaration') {
                for (const innerDecl of stmt.declarations) {
                  if (innerDecl.init && innerDecl.id.name) {
                    const innerName = innerDecl.id.name;
                    // Handle nested function expressions
                    if (innerDecl.init.type === 'FunctionExpression' ||
                        innerDecl.init.type === 'ArrowFunctionExpression' || innerDecl.init.type === 'ArrowFunction') {
                      const func = new PerlSub(innerName);
                      func.useSignatures = this.options.addSignatures;

                      if (innerDecl.init.params) {
                        for (const param of innerDecl.init.params) {
                          let paramName, defaultValue = null;
                          if (param.type === 'AssignmentPattern') {
                            paramName = param.left.name;
                            defaultValue = this.transformExpression(param.right);
                          } else if (param.defaultValue) {
                            paramName = param.name;
                            defaultValue = this.transformExpression(param.defaultValue);
                          } else {
                            paramName = param.name;
                            // JS allows calling with fewer args than declared (missing ones become undefined);
                            // Perl signatures require an explicit default to permit that.
                            defaultValue = PerlLiteral.Undef();
                          }
                          func.parameters.push(new PerlParameter(paramName, '$', null, defaultValue));
                          this.registerVariableType(paramName, '$');
                        }
                      }

                      if (innerDecl.init.body) {
                        if (innerDecl.init.body.type === 'BlockStatement') {
                          func.body = this.transformBlockStatement(innerDecl.init.body);
                        } else {
                          // Arrow function with expression body
                          func.body = new PerlBlock();
                          func.body.statements.push(new PerlReturn(this.transformExpression(innerDecl.init.body)));
                        }
                      }

                      doBlock.statements.push(func);
                    } else {
                      // Regular variable
                      const sigil = this.inferSigilFromValue(innerDecl.init);
                      const innerVarDecl = new PerlVarDeclaration('my', innerName, sigil,
                        this.transformExpression(innerDecl.init));
                      doBlock.statements.push(innerVarDecl);
                    }
                  }
                }
              }
              // Return statement becomes the do block's return
              else if (stmt.type === 'ReturnStatement' && stmt.argument) {
                doBlock.statements.push(this.transformExpression(stmt.argument));
              }
              // Other statements
              else {
                const transformed = this.transformStatement(stmt);
                if (transformed) {
                  if (Array.isArray(transformed))
                    doBlock.statements.push(...transformed);
                  else
                    doBlock.statements.push(transformed);
                }
              }
            }

            // Register the variable type so subsequent uses get the correct sigil
            this.registerVariableType(name, '$');
            this._pushModuleConstant(targetModule, name, '$', new PerlCall('do', [doBlock]));
          } else {
            // Arrow function with expression body - just use the return value
            const returnValue = this.getIIFEReturnValue(decl.init);
            if (returnValue) {
              const sigil = this.inferSigilFromValue(returnValue);
              // Register the variable type so subsequent uses get the correct sigil
              this.registerVariableType(name, sigil);
              this._pushModuleConstant(targetModule, name, sigil, this.transformExpression(returnValue));
            }
          }
        }
        // Handle class expressions: let ClassName = class extends X { ... }
        else if (decl.init.type === 'ClassExpression' || decl.init.type === 'ClassDeclaration') {
          const classNode = {
            ...decl.init,
            type: 'ClassDeclaration',
            id: decl.init.id || { name: name, type: 'Identifier' }
          };
          // transformClassDeclaration pushes directly to targetModule.statements
          this.transformClassDeclaration(classNode, targetModule);
        }
        // Handle function expressions as named subroutines
        // This handles hoisted IIFE functions: const piMix = (x, y) => { ... }
        else if (decl.init.type === 'FunctionExpression' ||
                 decl.init.type === 'ArrowFunctionExpression' || decl.init.type === 'ArrowFunction') {
          // Register this name as a function for code reference handling
          this.functionNames.add(name);

          const func = new PerlSub(name);
          func.useSignatures = this.options.addSignatures;

          // Parameters
          if (decl.init.params) {
            for (const param of decl.init.params) {
              let paramName, defaultValue = null;
              if (param.type === 'AssignmentPattern') {
                paramName = param.left.name;
                defaultValue = this.transformExpression(param.right);
              } else if (param.defaultValue) {
                paramName = param.name;
                defaultValue = this.transformExpression(param.defaultValue);
              } else {
                paramName = param.name;
                // JS allows calling with fewer args than declared (missing ones become undefined);
                // Perl signatures require an explicit default to permit that.
                defaultValue = PerlLiteral.Undef();
              }
              func.parameters.push(new PerlParameter(paramName, '$', null, defaultValue));
              this.registerVariableType(paramName, '$');
            }
          }

          // Body
          if (decl.init.body) {
            if (decl.init.body.type === 'BlockStatement') {
              func.body = this.transformBlockStatement(decl.init.body);
            } else {
              // Arrow function with expression body
              func.body = new PerlBlock();
              func.body.statements.push(new PerlReturn(this.transformExpression(decl.init.body)));
            }
          }

          targetModule.statements.push(func);
        }
        // Handle simple literals and expressions as constants
        // This includes many IL node types: Floor, Ceil, Round, Abs, Min, Max, etc.
        else {
          // Skip destructuring temps that reference module identifiers like:
          // _destructure_0 = AlgorithmFramework, _destructure_0 = FountainFoundation
          // These are generated by the IL for const { ... } = require('./module.js')
          if (decl.init.type === 'Identifier' && name.startsWith('_destructure')) {
            // Skip - these are module imports that resolve to undefined in Perl
            continue;
          }

          // Skip member access from framework modules like:
          // RegisterAlgorithm = AlgorithmFramework.RegisterAlgorithm
          if (decl.init.type === 'MemberExpression' &&
              decl.init.object.type === 'Identifier' &&
              (decl.init.object.name === 'AlgorithmFramework' || decl.init.object.name === 'OpCodes')) {
            // Skip - these are framework imports
            continue;
          }

          // Skip assignments that extract from framework destructure temps like:
          // $RegisterAlgorithm = $_destructure_0->RegisterAlgorithm
          // These are provided by the test harness
          if (decl.init.type === 'MemberExpression' &&
              decl.init.object.type === 'Identifier' &&
              decl.init.object.name.startsWith('_destructure')) {
            // Skip - these are framework imports
            continue;
          }

          // Skip bare identifier assignments that are framework exports
          // e.g., RegisterAlgorithm = RegisterAlgorithm (from destructuring)
          const frameworkExports = [
            'RegisterAlgorithm', 'CategoryType', 'SecurityStatus', 'ComplexityType',
            'CountryCode', 'AeadAlgorithm', 'IAeadInstance', 'BlockCipherAlgorithm',
            'IBlockCipherInstance', 'StreamCipherAlgorithm', 'IStreamCipherInstance',
            'HashFunctionAlgorithm', 'IHashFunctionInstance', 'MacAlgorithm', 'IMacInstance',
            'KdfAlgorithm', 'IKdfInstance', 'ChecksumAlgorithm', 'IChecksumInstance',
            'EncodingAlgorithm', 'IEncodingInstance', 'CompressionAlgorithm', 'ICompressionInstance',
            'ClassicalCipherAlgorithm', 'IClassicalCipherInstance', 'RandomAlgorithm', 'IRandomInstance',
            'EccAlgorithm', 'IEccInstance', 'CipherModeAlgorithm', 'ICipherModeInstance',
            'PaddingAlgorithm', 'IPaddingInstance', 'SignatureAlgorithm', 'ISignatureInstance',
            'KeyExchangeAlgorithm', 'IKeyExchangeInstance', 'KeyAgreementAlgorithm', 'IKeyAgreementInstance',
            'AsymmetricCipherAlgorithm', 'IAsymmetricCipherInstance', 'AsymmetricAlgorithm',
            'TestCase', 'KeySize', 'LinkItem', 'Vulnerability', 'AuthResult',
            'ErrorCorrectionAlgorithm', 'IErrorCorrectionInstance', 'CryptoAlgorithm', 'ICryptoInstance',
            'Algorithm', 'IAlgorithmInstance', 'OpCodes'
          ];
          if (decl.init.type === 'Identifier' && frameworkExports.includes(decl.init.name)) {
            // Skip - these are framework imports
            continue;
          }

          const sigil = this.inferSigilFromValue(decl.init);
          // Register the variable type so subsequent uses get the correct sigil
          this.registerVariableType(name, sigil);
          this._pushModuleConstant(targetModule, name, sigil, this.transformExpression(decl.init));
        }
      }
    }

    /**
     * Transform a function declaration
     */
    /**
     * Shared by transformFunctionDeclaration (module-top-level "function
     * foo() {...}") and transformStatement's 'FunctionDeclaration' case
     * (a nested helper declared *inside* another function/method body -
     * e.g. hash/haraka.js's "function aesMixColumns(state) { ...; function
     * mulX(p) { ... } ...; mulX(c0) ...; }", the Galois-multiply helper
     * for its MixColumns step). Builds the top-level case as a genuine
     * named PerlSub (pushed onto the module directly by the caller,
     * landing in "package main" - see PerlEmitter.js emitModule).
     *
     * The NESTED case instead builds "my $name = sub (...) {...};" - an
     * anonymous coderef assigned to a lexical - NOT a named "sub name
     * {...}", even though the latter is also legal Perl and was this
     * codebase's original approach. A named sub nested inside another sub
     * is compiled once, and (per perlsub's well-known "Variable will not
     * stay shared" gotcha) its closure over the enclosing method's `my`
     * locals binds to whichever call of the OUTER method happened to run
     * first - every LATER call (e.g. a second Gimli24HashInstance's own
     * Result(), or this same instance's _absorb() vs. Result() each
     * declaring their own "function stateToBytes() {...}") silently reuses
     * the FIRST call's stale $self/$stateBytes/etc, not the current call's
     * - the closure never rebinds. This produced "Use of uninitialized
     * value in bitwise and"/silently-wrong hashes in hash/gimli24-hash.js,
     * not a hard error, so it was easy to miss. An anonymous sub assigned
     * fresh to a `my` lexical on every entry into the enclosing method (the
     * normal Perl idiom for a "local closure", and how JS's OWN nested
     * function declarations actually behave - scoped fresh per call of the
     * enclosing function) gets a brand-new closure each time, matching JS
     * semantics exactly. Calls/value-reads of a nested function are
     * dispatched exactly like any other codeRefVariables entry (see its
     * registration below) - "$name->(...)"/"$name" rather than a bareword.
     * @param {object} node FunctionDeclaration
     * @param {boolean} [isNested] - true when called from transformStatement's
     *   nested-declaration case (see nestedFunctionNames' doc comment)
     * @returns {object} PerlSub (top-level) or PerlVarDeclaration (nested)
     */
    _buildFunctionSub(node, isNested = false) {
      const funcName = node.id.name;
      // Register this name as a function for code reference handling
      // (permanently - unlike codeRefVariables/nestedFunctionNames, see
      // _transformFunctionScopeBody's doc comment, functionNames' STAYING
      // set is what lets a later, unrelated, genuinely-top-level function
      // sharing this same name still resolve to a qualified "main::"
      // package-sub call instead of falling through to a plain bareword).
      this.functionNames.add(funcName);

      // See _collectNestedFunctionRenames' doc comment - a nested
      // declaration whose name collides with another same-named nested
      // declaration in a DIFFERENT sibling method gets a unique Perl
      // variable/sub name (call sites resolve the same way via
      // _resolveNestedFunctionName).
      const emittedName = isNested ? this._resolveNestedFunctionName(funcName) : funcName;

      const parameters = [];

      // Parameters
      // IMPORTANT: In Perl signatures, always use $ for parameters
      // - @ and % are "slurpy" and must be last in parameter list
      // - JavaScript arrays/objects are passed as references anyway
      if (node.params) {
        for (const param of node.params) {
          // Handle parameter with default value: function(x = 5) => sub($x = 5)
          let paramName, defaultValue = null;
          if (param.type === 'AssignmentPattern') {
            paramName = param.left.name;
            defaultValue = this.transformExpression(param.right);
          } else if (param.defaultValue) {
            paramName = param.name;
            defaultValue = this.transformExpression(param.defaultValue);
          } else {
            paramName = param.name;
            // JS allows calling with fewer args than declared (missing ones become undefined);
            // Perl signatures require an explicit default to permit that.
            defaultValue = PerlLiteral.Undef();
          }
          // $_ is a special variable in Perl - cannot be used as a formal parameter in signatures
          if (paramName === '_') paramName = '_unused';
          // Always use $ for function parameters to avoid slurpy issues
          const perlParam = new PerlParameter(paramName, '$', null, defaultValue);
          parameters.push(perlParam);
          // IMPORTANT: Register as scalar so it's used correctly in body
          // (not inferred, since parameter is always scalar in Perl signatures)
          this.registerVariableType(paramName, '$');
        }
      }

      // A parameter this function's own body calls directly as
      // "paramName(...)" holds a code reference, not a plain scalar - see
      // the matching (more extensively commented) fix in
      // transformFunctionExpression/_findParamsCalledAsFunctions.
      const declParamNames = new Set(parameters.map(pm => pm.name));
      const declCalledAsFunctionParams = this._findParamsCalledAsFunctions(declParamNames, node.body);
      const declAddedCodeRefParams = [];
      for (const pname of declCalledAsFunctionParams) {
        if (!this.codeRefVariables.has(pname)) {
          this.codeRefVariables.add(pname);
          declAddedCodeRefParams.push(pname);
        }
      }

      // Body - see _transformFunctionScopeBody's doc comment (SCOPED
      // registration of any nested declarations THIS body itself declares,
      // plus the "my $name;" pre-declaration hoist for forward references).
      const body = this._transformFunctionScopeBody(node.body);

      for (const pname of declAddedCodeRefParams) this.codeRefVariables.delete(pname);

      if (isNested) {
        // See this method's doc comment - only ASSIGN here (the "my"
        // pre-declaration already happened, once, in the ENCLOSING body via
        // _hoistNestedFunctionDeclVars), so re-running this assignment on
        // every entry into the enclosing body still creates a fresh
        // closure each time.
        return new PerlExpressionStatement(new PerlAssignment(
          new PerlIdentifier(emittedName, '$'), '=', new PerlAnonSub(parameters, body)
        ));
      }

      const func = new PerlSub(emittedName);
      func.useSignatures = this.options.addSignatures;
      func.parameters = parameters;
      func.body = body;
      return func;
    }

    transformFunctionDeclaration(node, targetModule) {
      // Apply the whole-file call-site string-parameter inference (see
      // _collectTopLevelFunctionStringParams) for the duration of this
      // top-level function's own body transform only - saved/restored
      // (rather than left to accumulate) so one function's params can't
      // leak into an unrelated sibling function that happens to reuse the
      // same parameter name, mirroring transformMethodDefinition's
      // identical stringVariables snapshot/restore.
      const funcName = node.id?.name;
      const prevStringVariables = new Set(this.stringVariables);
      const stringParams = funcName && this.topLevelFunctionStringParams.get(funcName);
      if (stringParams) for (const p of stringParams) this.stringVariables.add(p);

      targetModule.statements.push(this._buildFunctionSub(node));

      this.stringVariables = prevStringVariables;
    }

    /**
     * Transform a class declaration to a Perl package
     */
    transformClassDeclaration(node, targetModule = this.currentModule) {
      const className = node.id?.name;

      // Skip if no class name or no target module
      if (!className || !targetModule) return;

      // Track this class name for identifier resolution
      this.definedClassNames.add(className);

      // Skip framework utility classes (provided by runtime)
      if (SKIP_CLASSES.has(className))
        return;

      const perlClass = new PerlClass(className, {
        useModernClass: this.options.useModernClass
      });

      // Handle superclass
      if (node.superClass) {
        let baseName;
        if (node.superClass.type === 'MemberExpression') {
          // Handle AlgorithmFramework.BlockCipherAlgorithm
          baseName = node.superClass.property.name || node.superClass.property.value;
        } else {
          baseName = node.superClass.name;
        }
        perlClass.baseClass = baseName;

        // Track framework classes for stub generation
        if (baseName && FRAMEWORK_CLASSES.has(baseName))
          this.frameworkClasses.add(baseName);
      }
      this.classBaseClassName.set(className, perlClass.baseClass || null);

      const prevClass = this.currentClass;
      const prevClassName = this.currentClassName;
      this.currentClass = perlClass;
      this.currentClassName = className;

      // Handle both class body structures
      const members = node.body?.body || node.body || [];

      // See _collectNestedFunctionRenames' doc comment - must be computed
      // (and the previous class' map restored afterward) before any method
      // body below is transformed, since _buildFunctionSub/transformCallExpression
      // consult it live via currentMethodName.
      const prevNestedFuncRenames = this.currentClassNestedFuncRenames;
      this.currentClassNestedFuncRenames = this._collectNestedFunctionRenames(members);

      // Pre-scan for get/set accessor property names *before* transforming
      // any method bodies. Other methods in this class (Feed, Result, etc.)
      // reference these properties as `this.propName`, which must route
      // through the accessor method rather than raw hash-key access - see
      // _isAccessorProperty() / the ThisPropertyAccess and assignment
      // handling in transformExpression/transformAssignmentExpression.
      const accessorNames = new Set();
      for (const member of members) {
        if (member.type === 'MethodDefinition' && (member.kind === 'get' || member.kind === 'set'))
          accessorNames.add(member.key.name);
        // Also recognize the ES5 "Object.defineProperty(this, name, {get,set})"
        // idiom inside the constructor (see _matchDefinePropertyStatement) -
        // it defines a real accessor sub too (built further below, alongside
        // BUILD/ADJUST), so other methods' "this.name" reads/writes must
        // route through it exactly like a genuine get/set class member.
        if (member.type === 'MethodDefinition' && member.kind === 'constructor' && member.value?.body?.body) {
          for (const stmt of member.value.body.body) {
            const dp = this._matchDefinePropertyStatement(stmt);
            if (dp) accessorNames.add(dp.name);
          }
        }
      }
      this.classAccessors.set(className, accessorNames);

      // Pre-scan getter bodies for a structurally-string return value (e.g.
      // "get key() { return this._processedKey || 'A'; }") so this.key can
      // be recognized by isStringType() as a string later - not just
      // this.key[i], but also "for (const c of this.key)"-style patterns
      // once assigned into a local. Without this, string-backed key/alphabet
      // getters get misdetected as arrays and blow up at runtime
      // ("Can't use string as an ARRAY ref").
      const stringGetterNames = new Set();
      for (const member of members) {
        if (member.type === 'MethodDefinition' && member.kind === 'get') {
          const retStmt = (member.value?.body?.body || []).find(s => s.type === 'ReturnStatement' && s.argument);
          if (retStmt && this.isStringType(retStmt.argument))
            stringGetterNames.add(member.key.name);
        }
      }
      this.classStringGetters.set(className, stringGetterNames);

      // Pre-scan regular method bodies for a return statement that yields an
      // object literal with a "length" property (e.g. LZ-family compression
      // matchers: "_findLongestMatch(pos) { ...; return { distance, length }; }").
      // "match.length" on a variable assigned from such a call must resolve
      // to the hash key $match->{'length'}, not the built-in ArrayLength
      // (scalar(@{...})) - JS objects can freely have a field literally
      // named "length" that has nothing to do with array/string length.
      const lengthFieldMethods = new Set();
      for (const member of members) {
        if (member.type === 'MethodDefinition' && member.kind !== 'get' && member.kind !== 'set' && member.kind !== 'constructor') {
          const returns = [];
          this._collectReturnStatements(member.value?.body, returns);
          // The far more common shape is "let best = { distance, length };
          // ... ; return best;" (built up across a loop, e.g.
          // _findLongestMatch above) rather than a bare "return { ... };" -
          // track local names (re)assigned such an object literal anywhere
          // in the method body first, so a returned Identifier referencing
          // one of them is recognized too, not just a literal return value.
          const localLengthFieldVarNames = this._collectLengthFieldVarNames(member.value?.body);
          const isLengthFieldObjectExpr = (n) => n && (n.type === 'ObjectExpression' || n.type === 'ObjectLiteral') &&
            (n.properties || []).some(p => {
              const key = p.key;
              return (typeof key === 'string' ? key : (key?.name || key?.value)) === 'length';
            });
          const hasLengthFieldReturn = returns.some(r =>
            r.argument && (isLengthFieldObjectExpr(r.argument) ||
              (r.argument.type === 'Identifier' && localLengthFieldVarNames.has(r.argument.name))));
          if (hasLengthFieldReturn)
            lengthFieldMethods.add(member.key.name);
        }
      }
      this.classLengthFieldMethods.set(className, lengthFieldMethods);

      // Pre-scan regular method bodies for a return value that's always
      // structurally a function (FunctionExpression/ArrowFunctionExpression) -
      // e.g. "_getHMACFunction() { if (...) return (k,m)=>...; else if (...)
      // return (k,m)=>...; else throw ...; }" (every *reachable* return is a
      // closure; a non-returning "throw" branch doesn't count against it).
      // A local assigned from such a call - "const hmacFunc = this.
      // _getHMACFunction(); hmacFunc(a, b);" - must be called through a
      // coderef deref ("$hmacFunc->(a, b)"), exactly like codeRefVariables
      // already ensures for a directly-assigned arrow function - without
      // this, the call emitted as a bareword "hmacFunc(a, b)", which Perl
      // resolves as a call to a *named sub* of that name (none exists),
      // dying with "Undefined subroutine &Foo::hmacFunc called".
      const functionReturningMethods = new Set();
      for (const member of members) {
        if (member.type === 'MethodDefinition' && member.kind !== 'get' && member.kind !== 'set' && member.kind !== 'constructor') {
          const returns = [];
          this._collectReturnStatements(member.value?.body, returns);
          const isFuncExpr = (n) => n && (n.type === 'FunctionExpression' ||
            n.type === 'ArrowFunctionExpression' || n.type === 'ArrowFunction');
          if (returns.length > 0 && returns.every(r => isFuncExpr(r.argument)))
            functionReturningMethods.add(member.key.name);
        }
      }
      this.classFunctionReturningMethods.set(className, functionReturningMethods);

      // Pre-scan regular (non-getter) method bodies for a structurally-string
      // return value too - not just get-accessors (stringGetterNames above).
      // e.g. "normalizeText(text) { return text.toUpperCase().replace(...); }"
      // followed elsewhere by "const normalized = this.normalizeText(x);
      // if (normalized.length % 2 === 1)" - without this, "normalized" isn't
      // recognized as a string by transformLetStatement's isStringType(decl.init)
      // check, so "normalized.length" falls through to array semantics
      // (scalar(@$normalized)) and blows up ("Can't use string ... as an
      // ARRAY ref") since it actually holds a plain string. Reuses the same
      // classStringGetters map/lookup isStringType already consults for
      // getters - a "this.foo()" call is checked there exactly like "this.foo".
      //
      // A return argument can itself be a plain local Identifier assigned
      // from another such string-returning method a few lines earlier (e.g.
      // "prepareText() { const normalized = this.normalizeText(x); ...;
      // return normalized; }") - isStringType() alone can't see that (its
      // Identifier case relies on this.stringVariables, which is populated
      // during the *actual* transform pass, not yet during this pre-scan).
      // _localVarLooksLikeString resolves that one hop via a local scan of
      // the same method body. Run as a small fixed-point loop (methods can
      // call each other in either file order) so e.g. normalizeText is
      // discovered before prepareText even if declared after it.
      const looksLikeStringLocal = (n, methodBody, _depth = 0, paramNames = null) => {
        if (!n || _depth > 4) return false;
        if (this.isStringType(n)) return true;
        if (n.type === 'Identifier') {
          let found = null;
          const findDecl = (node) => {
            if (found || !node || typeof node !== 'object') return;
            if (Array.isArray(node)) { for (const it of node) findDecl(it); return; }
            if (node.type === 'VariableDeclarator' && node.id?.name === n.name && node.init) { found = node.init; return; }
            if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression' || node.type === 'ArrowFunction') return;
            for (const key of Object.keys(node)) {
              if (key === 'parent' || key === '_parent') continue;
              findDecl(node[key]);
              if (found) return;
            }
          };
          findDecl(methodBody);
          // Recurse (not just a flat isStringType(found)) so e.g. "let
          // char1 = normalizedInput[i];" chains into the MemberExpression
          // case below, which itself chains into "normalizedInput"'s own
          // declaration - a computed index into a string is itself a
          // string, same as JS's str[i]/str.charAt(i).
          if (found) return looksLikeStringLocal(found, methodBody, _depth + 1, paramNames);
          // No local declaration matched - this may be a bare early-exit
          // guard returning one of the method's OWN parameters unchanged
          // (e.g. "encryptRailFence(plaintext, rails) { if (plaintext.
          // length === 0 || rails < 2) return plaintext; ...; return
          // result; }" - both this guard return and the main "return
          // result" need to agree it's a string for the whole method to be
          // flagged). Reuses _inferStringParamsFromUsage's own-body usage
          // evidence (e.g. "plaintext.charAt(i)" elsewhere in the same
          // method) - the same signal transformMethodDefinition already
          // trusts to type a parameter as a string for the body transform,
          // just consulted here too so the *return type* pre-scan sees it.
          if (paramNames && paramNames.has(n.name)) {
            const inferred = this._inferStringParamsFromUsage(methodBody, paramNames);
            if (inferred.has(n.name)) return true;
          }
        }
        // Computed member access (str[i]) into a locally-declared string -
        // isStringType() alone only recognizes this via the *live*
        // this.stringVariables set (populated during the real transform
        // pass, not yet during this prescan), so it must be re-checked here
        // against the same local declaration lookup used for Identifiers.
        if (n.type === 'MemberExpression' && n.computed)
          return looksLikeStringLocal(n.object, methodBody, _depth + 1, paramNames);
        return false;
      };
      for (let pass = 0; pass < 3; ++pass) {
        let added = false;
        for (const member of members) {
          if (member.type === 'MethodDefinition' && member.kind !== 'get' && member.kind !== 'set' && member.kind !== 'constructor') {
            if (stringGetterNames.has(member.key.name)) continue;
            const returns = [];
            this._collectReturnStatements(member.value?.body, returns);
            const paramNames = new Set((member.value?.params || []).map(p => (p.type === 'AssignmentPattern' ? p.left.name : p.name)).filter(Boolean));
            if (returns.length > 0 && returns.every(r => r.argument && looksLikeStringLocal(r.argument, member.value?.body, 0, paramNames))) {
              stringGetterNames.add(member.key.name);
              added = true;
            }
          }
        }
        if (!added) break;
      }
      this.classStringGetters.set(className, stringGetterNames);

      // Cross-call-site parameter type inference. A method's own parameters
      // carry no JS type annotation, and usage-based inference within the
      // method's *own* body (_inferStringParamsFromUsage, applied per-method
      // below) only catches a handful of shapes (string-literal comparisons,
      // string concatenation, .charAt()-style calls) - a parameter only ever
      // used in e.g. "matrix[row][col] === char" gives no such local clue.
      // But every *caller* of that method often passes it a structurally-
      // string argument (e.g. "this.findPosition(text.charAt(i), matrix)")
      // - exactly the same kind of evidence stringGetterNames above already
      // exploits for whole-method return values, just applied to inputs
      // instead of outputs. Scan every this.<method>(...) call in the class;
      // if a given parameter position is passed a structurally-string
      // argument at every call site (and there's at least one call site),
      // that parameter is treated as a string for the duration of the
      // method's own body transform (see transformMethodDefinition below).
      // Without this, "char" params compared against string-typed array
      // elements defaulted to Perl's numeric "==" instead of "eq" - always
      // false for non-numeric strings, silently corrupting output rather
      // than crashing (e.g. Playfair's findPosition() never matching,
      // making every digraph fall through to its "not found" fallback).
      const methodParamNames = new Map(); // methodName -> [paramName, ...]
      for (const member of members) {
        if (member.type === 'MethodDefinition' && member.kind !== 'get' && member.kind !== 'set' && member.kind !== 'constructor') {
          const names = (member.value?.params || []).map(p => (p.type === 'AssignmentPattern' ? p.left.name : p.name));
          methodParamNames.set(member.key.name, names);
        }
      }
      // Each call site also records which method it's *inside* (scopeMethod)
      // so an argument that's itself just a same-named forwarded parameter
      // (e.g. processDigraph(char1, char2, ...) calling
      // this.findPosition(char1, matrix) - char1 is processDigraph's own
      // parameter, not a local "let"/"const") can be resolved through
      // callSiteStringParams from an earlier fixed-point pass below, not
      // just through local variable declarations.
      const callSitesByMethod = new Map(); // methodName -> [{args, scopeBody, scopeMethod}, ...]
      const collectThisMethodCalls = (node, scopeBody, scopeMethod) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { for (const n of node) collectThisMethodCalls(n, scopeBody, scopeMethod); return; }
        if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression' ||
            node.type === 'ArrowFunction' || node.type === 'FunctionDeclaration')
          return;
        if (node.type === 'ThisMethodCall' && node.method && methodParamNames.has(node.method)) {
          if (!callSitesByMethod.has(node.method)) callSitesByMethod.set(node.method, []);
          callSitesByMethod.get(node.method).push({ args: node.arguments || [], scopeBody, scopeMethod });
        }
        for (const key of Object.keys(node)) {
          if (key === 'parent' || key === '_parent') continue;
          collectThisMethodCalls(node[key], scopeBody, scopeMethod);
        }
      };
      for (const member of members) {
        if (member.type === 'MethodDefinition' && member.value?.body)
          collectThisMethodCalls(member.value.body, member.value.body, member.key.name);
      }
      // Fixed-point loop (mirrors the classStringGetters 3-pass loop above):
      // a call site argument that's just a forwarded parameter of the
      // *calling* method (e.g. processDigraph's char1/char2 passed straight
      // through to findPosition) can only be resolved once processDigraph's
      // own params have themselves been flagged string, which may happen in
      // an earlier or later member than the one being scanned.
      const callSiteStringParams = new Map(); // methodName -> Set(paramName)
      const isArgStringy = (argNode, scopeBody, scopeMethod) => {
        if (looksLikeStringLocal(argNode, scopeBody)) return true;
        if (argNode.type === 'Identifier' && scopeMethod) {
          const scopeParams = methodParamNames.get(scopeMethod);
          if (scopeParams && scopeParams.includes(argNode.name))
            return !!callSiteStringParams.get(scopeMethod)?.has(argNode.name);
        }
        return false;
      };
      for (let pass = 0; pass < 3; ++pass) {
        let changed = false;
        for (const [methodName, calls] of callSitesByMethod) {
          if (calls.length === 0) continue;
          const paramNames = methodParamNames.get(methodName) || [];
          let stringParamSet = callSiteStringParams.get(methodName);
          for (let i = 0; i < paramNames.length; ++i) {
            if (!paramNames[i] || (stringParamSet && stringParamSet.has(paramNames[i]))) continue;
            const allString = calls.every(c => c.args[i] && isArgStringy(c.args[i], c.scopeBody, c.scopeMethod));
            if (allString) {
              if (!stringParamSet) { stringParamSet = new Set(); callSiteStringParams.set(methodName, stringParamSet); }
              stringParamSet.add(paramNames[i]);
              changed = true;
            }
          }
        }
        if (!changed) break;
      }
      const prevCallSiteStringParams = this.callSiteStringParams;
      this.callSiteStringParams = callSiteStringParams;

      // Collect getters and setters to combine them
      const accessors = new Map(); // name -> { getter: node, setter: node }

      if (members && members.length > 0) {
        for (const member of members) {
          if (member.type === 'MethodDefinition') {
            if (member.kind === 'constructor') {
              // Track that this class has a real constructor-derived BUILD,
              // so subclasses that call super(args) can chain into it via
              // SUPER::BUILD instead of silently dropping the call.
              this.classesWithConstructor.add(className);

              // Extract fields from constructor
              const fields = this.extractFieldsFromConstructor(member);
              for (const field of fields) {
                perlClass.fields.push(field);
              }

              // Extract Object.defineProperty(this, name, {get,set}) accessors
              // (see _matchDefinePropertyStatement) into real Perl accessor
              // subs, exactly like a genuine ES6 get/set class member would be.
              if (member.value?.body?.body) {
                for (const stmt of member.value.body.body) {
                  const dp = this._matchDefinePropertyStatement(stmt);
                  if (!dp) continue;
                  const getterNode = this._wrapAccessorFunction(dp.getterFn);
                  const setterNode = this._wrapAccessorFunction(dp.setterFn);
                  const combinedMethod = this.transformAccessorPair(dp.name, getterNode, setterNode);
                  perlClass.methods.push(combinedMethod);
                }
              }

              // Also create ADJUST/BUILD method if needed
              const method = this.transformConstructor(member);
              if (method) {
                perlClass.methods.push(method);
              }
            } else if (member.kind === 'get' || member.kind === 'set') {
              // Collect getter/setter pairs
              const name = member.key.name;
              if (!accessors.has(name)) {
                accessors.set(name, { getter: null, setter: null });
              }
              if (member.kind === 'get') {
                accessors.get(name).getter = member;
              } else {
                accessors.get(name).setter = member;
              }
            } else {
              // Regular method
              const method = this.transformMethodDefinition(member);
              perlClass.methods.push(method);
            }
          } else if (member.type === 'PropertyDefinition' || member.type === 'FieldDefinition') {
            // Field. The type-aware-transpiler's parser emits 'FieldDefinition'
            // (see its FieldDefinition-producing sites) for both instance
            // fields (rare - most instance fields are set via "this.x = ..."
            // in the constructor, already handled by extractFieldsFromConstructor
            // above) and ES2022 "static NAME = ..." class fields (e.g.
            // block/gift128.js's "static RC = Object.freeze([...])" round-
            // constant table, block/aria.js's/sm4.js's static S-box tables).
            // A static field must NOT become a per-instance hash key (every
            // instance would silently start with no round constants at all,
            // read back as undef -> 0 in bitwise ops - AddRoundKey then only
            // XORs in half its constant, corrupting every round without ever
            // throwing) - it's routed to staticFields instead, emitted once
            // as a $ClassName::name package variable (see emitClass), which
            // matches the $ClassName::name package-variable read/write side
            // already implemented in transformMemberExpression/
            // transformAssignmentExpression's _isClassObjName/
            // _isClassStaticField branches.
            const field = this.transformPropertyDefinition(member);
            if (field.isStatic) perlClass.staticFields.push(field);
            else perlClass.fields.push(field);
          } else if (member.type === 'StaticBlock') {
            // ES2022 static block -> Perl module-level statements
            const initStatements = this.transformStaticBlock(member);
            if (initStatements) {
              perlClass.staticInitStatements = perlClass.staticInitStatements || [];
              perlClass.staticInitStatements.push(...initStatements);
            }
          }
        }

        // Process getter/setter pairs into combined methods
        for (const [name, pair] of accessors) {
          const combinedMethod = this.transformAccessorPair(name, pair.getter, pair.setter);
          perlClass.methods.push(combinedMethod);
        }
      }

      this.currentClass = prevClass;
      this.currentClassName = prevClassName;
      this.currentClassNestedFuncRenames = prevNestedFuncRenames;
      this.callSiteStringParams = prevCallSiteStringParams;

      targetModule.statements.push(perlClass);
    }

    /**
     * Check whether propName is backed by a get/set accessor pair on the
     * current class or one of its ancestors (walking up via
     * classBaseClassName, which is populated as each class is
     * transformed - ancestors are always transformed first because JS
     * requires "extends X" to reference an already-declared X).
     * @param {string} propName
     * @returns {boolean}
     */
    /**
     * Is this bare identifier name a "class object" for the purposes of
     * static-field/package-variable access - i.e. does "Name.field" mean
     * the Perl package variable $Name::field rather than a real object
     * dereference? Shared between the read side (transformMemberExpression)
     * and the write side (transformAssignmentExpression's "ClassName.field
     * = value" branch) so both agree on the same set of names - see the
     * static-field assignment comment in transformAssignmentExpression for
     * why they must.
     * @param {string} objName
     * @returns {boolean}
     */
    _isClassObjName(objName) {
      return /^[A-Z]/.test(objName) &&
        (this.definedClassNames.has(objName) ||
         objName.endsWith('Array') || objName.endsWith('Algorithm') || objName.endsWith('Instance') ||
         objName.endsWith('Point') || objName.endsWith('Cipher') || objName.endsWith('Module') ||
         objName.endsWith('Utils') || objName.endsWith('Transform') || objName.endsWith('Encoder') ||
         objName.endsWith('Decoder') || objName.endsWith('Generator') || objName.endsWith('Factory') ||
         objName.endsWith('Core') || objName.endsWith('Constants') || objName.endsWith('Helper') ||
         objName.endsWith('Hasher') || objName.endsWith('Tree') || objName.endsWith('Front') ||
         objName === 'OpCodes' || objName === 'AlgorithmFramework' || objName === 'NumberTheory') &&
        !this.variableTypes.has(objName);
    }

    /**
     * Static/data-field property names treated as a Perl package variable
     * ($ClassName::field) rather than a hash key when read/written through
     * a class-object identifier (_isClassObjName) - see the dataProps/
     * staticFieldNames doc comment at its use site in
     * transformMemberExpression for the full rationale.
     * @param {string} member
     * @returns {boolean}
     */
    _isClassStaticField(member) {
      const dataProps = new Set([
        'ROUNDS', 'DELTA', 'CYCLES', 'NUM_WORDS', 'WORD_SIZE', 'KEY_SCHEDULE_SIZE',
        'BlockSize', 'KeySize', 'IvSize', 'OutputSize',
        'spBox', 'spBoxInitialized', 'sBox', 'sbox',
      ]);
      return dataProps.has(member) || (this.staticFieldNames && this.staticFieldNames.has(member));
    }

    _isAccessorProperty(propName, startClassName) {
      let className = startClassName || this.currentClass?.name;
      const seen = new Set();
      while (className && !seen.has(className)) {
        seen.add(className);
        const names = this.classAccessors.get(className);
        if (names && names.has(propName)) return true;
        className = this.classBaseClassName.get(className);
      }
      return false;
    }

    /**
     * Does this (raw JS/IL) expression node structurally always evaluate to
     * the OpCodes module itself? Recognizes the bare "OpCodes" identifier,
     * "global.OpCodes"/"globalThis.OpCodes"/"window.OpCodes"/"self.OpCodes",
     * and a "typeof OpCodes !== 'undefined' ? OpCodes : <fallback>"-style
     * conditional (either branch referencing OpCodes is enough - see
     * opCodesAliasNames' doc comment for the real-world pattern this exists
     * for).
     * @param {object} node
     * @returns {boolean}
     */
    _exprIsOpCodesReference(node) {
      if (!node) return false;
      if (node.type === 'Identifier' && node.name === 'OpCodes') return true;
      if (node.type === 'MemberExpression' && !node.computed) {
        const objName = node.object?.type === 'Identifier' ? node.object.name : null;
        const propName = node.property?.name || node.property?.value;
        if (propName === 'OpCodes' && ['global', 'globalThis', 'window', 'self'].includes(objName))
          return true;
      }
      if (node.type === 'ConditionalExpression')
        return this._exprIsOpCodesReference(node.consequent) || this._exprIsOpCodesReference(node.alternate);
      return false;
    }

    /**
     * Recursively scan a raw JS/IL (sub-)AST for a bare Identifier node with
     * the given name, used as an actual expression reference rather than a
     * bare (non-computed) property/object-key name - see the "self"/"this"
     * collision comment in transformObjectAccessorPair for why this
     * distinction matters. Property/key names are stored as {type:
     * 'Identifier', name: X} too even though they're not variable
     * references, so `.property`/`.key` are skipped whenever the owning
     * node is non-computed (computed: false or absent, i.e. `obj.foo` /
     * `{foo: 1}`, as opposed to `obj[foo]` / `{[foo]: 1}` where the
     * identifier genuinely is a value reference).
     * @param {object} node
     * @param {string} name
     * @returns {boolean}
     */
    _hasFreeIdentifier(node, name) {
      if (!node || typeof node !== 'object') return false;
      if (Array.isArray(node)) return node.some(n => this._hasFreeIdentifier(n, name));
      if ((node.type === 'Identifier' || node.ilNodeType === 'Identifier') && node.name === name) return true;
      for (const k of Object.keys(node)) {
        if ((k === 'property' || k === 'key') && node.computed === false) continue;
        if (this._hasFreeIdentifier(node[k], name)) return true;
      }
      return false;
    }

    /**
     * Clone a raw JS/IL (sub-)AST, renaming every bare Identifier reference
     * (see _hasFreeIdentifier) from oldName to newName. Used to resolve the
     * "self"/"this" naming collision documented in transformObjectAccessorPair.
     * @param {object} node
     * @param {string} oldName
     * @param {string} newName
     * @returns {object}
     */
    _renameFreeIdentifier(node, oldName, newName) {
      if (!node || typeof node !== 'object') return node;
      if (Array.isArray(node)) return node.map(n => this._renameFreeIdentifier(n, oldName, newName));
      if ((node.type === 'Identifier' || node.ilNodeType === 'Identifier') && node.name === oldName)
        return Object.assign({}, node, { name: newName });
      const clone = {};
      for (const k of Object.keys(node)) {
        if ((k === 'property' || k === 'key') && node.computed === false) {
          clone[k] = node[k];
          continue;
        }
        clone[k] = this._renameFreeIdentifier(node[k], oldName, newName);
      }
      return clone;
    }

    /**
     * Heuristic: does this object expression refer to a block-cipher (or
     * similar sub-cipher) instance obtained via CreateInstance()? Such
     * instances always expose their key through a get/set accessor pair
     * (see e.g. "set key(keyBytes)" in algorithms/block/rijndael.js), which
     * lives in a different file/transpile unit than the mode/AEAD
     * construction copying the key into it - classAccessors here has no
     * visibility into that other class, so _isAccessorProperty() alone
     * can't detect it. Every algorithm in this codebase names these
     * locals/fields consistently - cipher, cipher1, blockCipher,
     * encryptCipher, decryptCipher, encipher2, decipher3, tweakCipher, ...
     * always ending in "cipher" optionally followed by a digit - which this
     * checks for instead.
     * @param {object} objNode
     * @returns {boolean}
     */
    _isCipherInstanceRef(objNode) {
      if (!objNode) return false;
      const CIPHER_NAME_RE = /cipher\d*$/i;
      if (objNode.type === 'Identifier')
        return CIPHER_NAME_RE.test(objNode.name) || this.createInstanceVarNames.has(objNode.name);
      if (objNode.type === 'ThisPropertyAccess')
        return CIPHER_NAME_RE.test(objNode.property) || this.createInstanceVarNames.has(objNode.property);
      if (objNode.type === 'MemberExpression' && objNode.object?.type === 'ThisExpression' && !objNode.computed) {
        const propName = objNode.property?.name || objNode.property?.value;
        return CIPHER_NAME_RE.test(propName || '') || this.createInstanceVarNames.has(propName || '');
      }
      return false;
    }

    /**
     * Unwrap chained calls like "new Array(N).fill(null)" or "[].concat(x)"
     * down to their base expression - the base is what actually establishes
     * the array/hash-ness. The IL pass pre-converts some of these (.fill,
     * .slice, .map, ...) into dedicated node types (ArrayFill, ArraySlice,
     * ...) that carry the source array in an `.array` field instead of a
     * CallExpression.
     *
     * "Object.freeze(X)"/"Object.seal(X)" are special-cased first: they're
     * transparent identity wrappers around a literal (the overwhelmingly
     * common way this codebase declares constant tables: "const RCON =
     * Object.freeze([...]);"), but the *generic* method-chain unwrap right
     * below assumes a receiver-holds-the-value pattern like "arr.fill(0)"
     * (unwraps to callee.object, i.e. the array being called) - for
     * Object.freeze/seal the array/object is the *argument* instead, so
     * without this special case the generic unwrap resolved to the
     * unrelated "Object" identifier and the whole constant silently
     * dropped out of array/hash-shape detection entirely.
     * @param {object} base
     * @returns {object}
     */
    _unwrapArrayLikeBase(base) {
      while (base) {
        // The IL pass pre-converts "Object.freeze(X)"/"Object.seal(X)" into
        // a dedicated ObjectFreeze node carrying X in `.object` - handled
        // first, before the CallExpression form below (which would never
        // actually see one, but is kept as a defensive fallback in case a
        // future IL pass version stops pre-converting it).
        if (base.type === 'ObjectFreeze' && base.object) {
          base = base.object;
          continue;
        }
        if (base.type === 'CallExpression' && base.callee?.type === 'MemberExpression' &&
            base.callee.object?.type === 'Identifier' && base.callee.object.name === 'Object' &&
            (base.callee.property?.name === 'freeze' || base.callee.property?.name === 'seal') &&
            base.arguments && base.arguments.length > 0) {
          base = base.arguments[0];
          continue;
        }
        if (base.type === 'CallExpression' && base.callee?.type === 'MemberExpression') {
          base = base.callee.object;
          continue;
        }
        if (base.array && typeof base.array === 'object') {
          base = base.array;
          continue;
        }
        break;
      }
      return base;
    }

    /**
     * Classify an (already-unwrapped, see _unwrapArrayLikeBase) expression
     * node as structurally array-producing, hash-producing, or neither.
     * Also resolves the shorthand/aliasing case where the expression is
     * itself just an Identifier referencing an already-known local
     * array/hash variable (e.g. object-literal shorthand property "{
     * limit }" aliasing "const limit = new Int32Array(...);") - callers
     * that need this must run after _localArrayVarNames/_localHashVarNames
     * are fully populated (see _collectObjectLiteralPropertyShapes, run as
     * a second whole-file pass for exactly this reason).
     * @param {object} base
     * @returns {'array'|'hash'|null}
     */
    _classifyLiteralShape(base) {
      if (!base) return null;
      const ARRAY_CTOR_RE = /^(Array|Uint8Array|Int8Array|Uint8ClampedArray|Uint16Array|Int16Array|Uint32Array|Int32Array|Float32Array|Float64Array)$/;
      if (base.type === 'ArrayExpression' ||
          base.type === 'ArrayCreation' || base.ilNodeType === 'ArrayCreation' ||
          base.type === 'TypedArrayCreation' || base.ilNodeType === 'TypedArrayCreation' ||
          (base.type === 'NewExpression' && ARRAY_CTOR_RE.test(base.callee?.name || '')))
        return 'array';
      if (base.type === 'ObjectExpression' || base.type === 'ObjectLiteral')
        return 'hash';
      if (base.type === 'Identifier') {
        const isArr = this._localArrayVarNames && this._localArrayVarNames.has(base.name);
        const isHash = this._localHashVarNames && this._localHashVarNames.has(base.name);
        if (isArr && !isHash) return 'array';
        if (isHash && !isArr) return 'hash';
      }
      return null;
    }

    /**
     * Recursively walk the whole (pre-transform) JS AST looking for
     * "this.field = new Array(...)" / "this.field = []" / "this.field = new
     * Uint8Array(...)" ("this.field = {}" for hashOut) style assignments,
     * wherever in the file they occur - often a dedicated key-expansion
     * method invoked well after the constructor, not the constructor
     * itself. Returns the Set of array-shaped field names found (also
     * populating hashOut with hash-shaped field names, when passed).
     * Used by isArrayContext() so this.field[computedIndex] elsewhere in
     * the class is recognized as array vs hash access even when the
     * field's name doesn't match any of the naming heuristics.
     * @param {object} node
     * @param {Set<string>} [out]
     * @param {Set<string>} [hashOut]
     * @returns {Set<string>}
     */
    _collectArrayFieldNames(node, out, hashOut) {
      out = out || new Set();
      hashOut = hashOut || new Set();
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const item of node) this._collectArrayFieldNames(item, out, hashOut);
        return out;
      }

      if (node.type === 'AssignmentExpression' && node.operator === '=') {
        const left = node.left;
        const isThisProp = left && (left.type === 'ThisPropertyAccess' ||
          (left.type === 'MemberExpression' && !left.computed && left.object?.type === 'ThisExpression'));
        if (isThisProp) {
          const fieldName = typeof left.property === 'string'
            ? left.property
            : (left.property?.name || left.property?.value);
          const base = this._unwrapArrayLikeBase(node.right);
          const shape = this._classifyLiteralShape(base);
          if (fieldName && shape === 'array') out.add(fieldName);
          else if (fieldName && shape === 'hash') hashOut.add(fieldName);
        }
      }

      // Same array-producing-initializer check, but for a plain local
      // "const/let/var x = [...]" declaration (e.g. "const multipliers =
      // [5n, 7n, 9n];" - a local lookup table/constant array), not just
      // "this.field = ...". Without this, isArrayContext() had no signal
      // for locals whose name doesn't match its hand-picked array-name-
      // pattern list (data/bytes/buffer/sbox/etc.) and would default a
      // later "multipliers[pass]" computed-index read to hash access
      // ("$multipliers->{$pass}"), dying with "Not a HASH reference" since
      // the variable actually holds a plain arrayref.
      //
      // Unlike "this.field" (a class-level name, effectively namespaced to
      // that class), a bare local name like "table" or "state" can easily be
      // reused for an array in one function and an unrelated object/hash in
      // another within the same file (or across dependency-bundled files -
      // see measure_pl.js) - this whole pre-scan has no real lexical scoping,
      // it's a flat whole-file walk. So local names are tracked separately
      // and any name that's *also* seen initialized from an object literal
      // somewhere is dropped as ambiguous before merging into `out`, rather
      // than risk wrongly forcing every occurrence to array access.
      if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier') {
        const base = this._unwrapArrayLikeBase(node.init);
        const shape = this._classifyLiteralShape(base);
        this._localArrayVarNames = this._localArrayVarNames || new Set();
        this._localHashVarNames = this._localHashVarNames || new Set();
        if (shape === 'array') this._localArrayVarNames.add(node.id.name);
        if (shape === 'hash') this._localHashVarNames.add(node.id.name);
      }

      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue; // avoid cycles on back-references, if any
        this._collectArrayFieldNames(node[key], out, hashOut);
      }
      return out;
    }

    /**
     * Flat whole-file scan for "X[<computed>] = {};" (or any object-literal
     * RHS) - a bare local/param array X whose ELEMENTS are themselves plain
     * hash-maps, e.g. ecc/multi-edge-ldpc.js's belief-propagation message
     * arrays: "const varToCheck = []; ...; varToCheck[v] = {}; ...;
     * varToCheck[v][c] = msgLLR;" (a sparse per-variable-node map of
     * check-index -> LLR value). Unlike _collectArrayFieldNames (which
     * tracks the shape of X itself), this tracks the shape of X's ELEMENTS,
     * used by isArrayContext() to recognize the OUTER index of a two-level
     * "X[a][b]" access (b here) as a hash key into that per-slot hash -
     * regardless of what b's own name looks like. Without this, a single-
     * letter loop variable used as the inner key (e.g. "c" in the example
     * above) matched isArrayContext()'s generic loop-index-name heuristics
     * and forced array access ("$varToCheck->[$v]->[$c]") on what is
     * actually a hashref at that slot ("$varToCheck->[$v] = {}"), dying
     * "Not an ARRAY reference" - silently swallowed by the test harness's
     * per-vector eval, showing up only as a wrong round-trip result with no
     * visible error.
     * @param {object} node
     * @param {Set<string>} [out]
     * @returns {Set<string>}
     */
    _collectArrayOfHashVarNames(node, out) {
      out = out || new Set();
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const item of node) this._collectArrayOfHashVarNames(item, out);
        return out;
      }
      if (node.type === 'AssignmentExpression' && node.operator === '=' &&
          node.left && node.left.type === 'MemberExpression' && node.left.computed &&
          node.left.object && node.left.object.type === 'Identifier') {
        const shape = this._classifyLiteralShape(this._unwrapArrayLikeBase(node.right));
        if (shape === 'hash') out.add(node.left.object.name);
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectArrayOfHashVarNames(node[key], out);
      }
      return out;
    }

    /**
     * Flat whole-file scan for method/function names whose return
     * statement(s) yield an expression that _classifyLiteralShape resolves
     * to the given shape ('array'|'hash') - mirrors
     * _collectTypedReturningMethodNames (used for the Map/Set IL-type case)
     * but for the array/hash *literal shape* heuristic instead of an exact
     * IL node type, so it also matches "build up a local array/object across
     * several statements, then return it" method bodies, not just a bare
     * "return [...]"/"return this._method()". Must run after
     * _collectArrayFieldNames has fully populated _localArrayVarNames/
     * _localHashVarNames (feeds _classifyLiteralShape's Identifier case).
     * @param {object} node
     * @param {'array'|'hash'} shape
     * @param {Set<string>} [out]
     * @returns {Set<string>}
     */
    _collectShapeReturningMethodNames(node, shape, out) {
      out = out || new Set();
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const n of node) this._collectShapeReturningMethodNames(n, shape, out);
        return out;
      }
      if ((node.type === 'MethodDefinition' || node.type === 'FunctionDeclaration') &&
          node.kind !== 'get' && node.kind !== 'set' && node.kind !== 'constructor') {
        const body = node.value?.body || node.body;
        const returns = [];
        this._collectReturnStatements(body, returns);
        const hasShapeReturn = returns.length > 0 && returns.some(r => {
          if (!r.argument) return false;
          const base = this._unwrapArrayLikeBase(r.argument);
          return this._classifyLiteralShape(base) === shape;
        });
        const name = node.key?.name || node.id?.name;
        if (hasShapeReturn && name) out.add(name);
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectShapeReturningMethodNames(node[key], shape, out);
      }
      return out;
    }

    /**
     * Flat whole-file scan for "this.field = this._method();"/"this.field =
     * someHelper();" where the called method/function name is in
     * arrayMethodNames or hashMethodNames (see _collectShapeReturningMethodNames)
     * - feeds arrayOut/hashOut the same way _collectArrayFieldNames' direct
     * "this.field = new Array(...)" case does.
     * @param {object} node
     * @param {Set<string>} arrayMethodNames
     * @param {Set<string>} arrayOut
     * @param {Set<string>} hashMethodNames
     * @param {Set<string>} hashOut
     */
    _collectMethodResultFieldNames(node, arrayMethodNames, arrayOut, hashMethodNames, hashOut) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (const n of node) this._collectMethodResultFieldNames(n, arrayMethodNames, arrayOut, hashMethodNames, hashOut);
        return;
      }
      if (node.type === 'AssignmentExpression' && node.operator === '=') {
        const left = node.left;
        const isThisProp = left && (left.type === 'ThisPropertyAccess' ||
          (left.type === 'MemberExpression' && !left.computed && left.object?.type === 'ThisExpression'));
        const right = node.right;
        const calledName = right && (right.type === 'ThisMethodCall' ? right.method :
          (right.type === 'CallExpression' ? (right.callee?.name || right.callee?.property?.name) : null));
        if (isThisProp && calledName) {
          const fieldName = typeof left.property === 'string' ? left.property : (left.property?.name || left.property?.value);
          if (fieldName) {
            if (arrayMethodNames.has(calledName)) arrayOut.add(fieldName);
            else if (hashMethodNames.has(calledName)) hashOut.add(fieldName);
          }
        }
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectMethodResultFieldNames(node[key], arrayMethodNames, arrayOut, hashMethodNames, hashOut);
      }
    }

    /**
     * Object-literal keys written as non-decimal JS numeric literals
     * (0x1F/0o17/0b101) are ECMAScript NumericLiterals - ToPropertyKey
     * evaluates them to their numeric VALUE and then stringifies that
     * ("31"/"15"/"5"), not their source spelling. The parser/IL pass hands
     * such keys through here as their raw source text instead (e.g.
     * "0b00"/"0b01"), so without normalizing, a lookup table like
     * "{ 0b00: [...], 0b01: [...] }" indexed at runtime by the actual
     * numeric value (0, 1, ...) silently misses every entry (see
     * algorithms/ecc/bicycle-code.js's LOGICAL_CODEWORDS_6_2_2). Plain
     * decimal keys ("0", "1", "1.5") already arrive correctly and pass
     * through unchanged.
     * @param {string|number|null|undefined} raw
     * @returns {string|number|null|undefined}
     */
    _normalizeLiteralObjectKey(raw) {
      if (raw == null) return raw;
      const s = String(raw);
      if (/^0[xXoObB][0-9a-fA-F]+$/.test(s)) {
        const n = Number(s);
        if (Number.isFinite(n)) return String(n);
      }
      return raw;
    }

    /**
     * Second whole-file pass (run after _collectArrayFieldNames, so
     * _localArrayVarNames/_localHashVarNames are fully populated regardless
     * of source order) collecting object-literal property key names whose
     * value is itself array/hash-shaped - either directly ("{ counts: new
     * Array(256).fill(0), total: 0 }") or via shorthand/aliasing reference
     * to an already-known local array/hash variable ("{ limit }" aliasing
     * "const limit = new Int32Array(...);", the common "tables.push({
     * minLen, maxLen, limit, base, perm })" record-building idiom). Adds
     * directly into the same arrayFieldNames/hashFieldNames sets
     * _collectArrayFieldNames populates, since isArrayContext's "obj.field[
     * computed]" check (for any receiver, not just `this`) keys off field
     * *name* alone - see its doc comment.
     * @param {object} node
     * @param {Set<string>} out
     * @param {Set<string>} hashOut
     */
    _collectObjectLiteralPropertyShapes(node, out, hashOut) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (const item of node) this._collectObjectLiteralPropertyShapes(item, out, hashOut);
        return;
      }

      if (node.type === 'ObjectExpression' || node.type === 'ObjectLiteral') {
        for (const prop of (node.properties || [])) {
          const keyName = prop.key == null ? null :
            this._normalizeLiteralObjectKey(typeof prop.key === 'string' ? prop.key : (prop.key.name || prop.key.value));
          if (!keyName || !prop.value) continue;
          const base = this._unwrapArrayLikeBase(prop.value);
          const shape = this._classifyLiteralShape(base);
          if (shape === 'array') out.add(keyName);
          else if (shape === 'hash') hashOut.add(keyName);
        }
      }

      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectObjectLiteralPropertyShapes(node[key], out, hashOut);
      }
    }

    /**
     * Shallow scan for any BigInt literal (`5n`, resultType 'bigint', etc.)
     * anywhere in the AST. See the comment at its call site in transform()
     * for why this drives the '~'/'+'/'-'/'+='/'-=' 64-bit-safety heuristics.
     * @param {object} node
     * @param {number} [depth]
     * @returns {boolean}
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
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        const v = node[key];
        if (v && typeof v === 'object' && this._scanForBigIntLiterals(v, depth + 1)) return true;
      }
      return false;
    }

    /**
     * Shallow scan for a "**" (exponentiation) BinaryExpression anywhere in
     * the file - see this field's call site (the self-referential shift-
     * accumulate assignment's "provably safe" guard in
     * transformAssignmentExpression) for why this matters. A BigInt-
     * flagged file that genuinely exponentiates (e.g. block/ff.js's
     * BigIntegerUtils.pow(), "base ** exponent") is doing arbitrary-
     * precision modular arithmetic against a modulus that's rarely a power
     * of two (FF1's radix**m, radix routinely 10 or 36) - unlike the fixed-
     * width 64-bit hash/PRNG family (Tiger/Skein/SHA-512/...), which never
     * exponentiates and stays entirely within power-of-two-modulus (or no
     * modulus at all) 64-bit-wraparound arithmetic. A value built by an
     * exactly-64-bit-wide shift-accumulate loop (e.g. fromByteArray's "for
     * d bytes: result = (result<<8)|byte" with d=8) is bit-for-bit correct
     * as a native Perl 64-bit two's-complement scalar taken alone - but
     * once such a file later adds that value to another and reduces by a
     * non-power-of-two modulus (this codebase's Math::BigInt-based '%'-of-
     * arithmetic rewrite, see the '%'-of-'*'/'+'/'-' case), the *native*
     * 64-bit-wraparound addition feeding into that reduction can silently
     * discard a genuine overflow carry past 2**64 - invisible to the
     * exactly-64-bits-fits heuristic, which only proves the shift-
     * accumulate's OWN result fits, not what happens to it afterward.
     * Scoped narrowly to "this file uses a genuine BigInt '**' operator"
     * (verified empirically to be true only for block/ff.js among every
     * currently-passing BigInt-flagged file) so the fixed-width hash/PRNG
     * family's own exactly-64-bit shift-accumulate loops (e.g.
     * hash/sha512.js's message-schedule word packing) keep their existing,
     * deliberately cheaper native-integer fast path.
     * @param {object} node
     * @param {number} [depth]
     * @returns {boolean}
     */
    _scanForBigIntPow(node, depth) {
      if (!node || typeof node !== 'object') return false;
      if (depth === undefined) depth = 0;
      if (depth > 200) return false;
      if (Array.isArray(node)) {
        for (const n of node) {
          if (this._scanForBigIntPow(n, depth + 1)) return true;
        }
        return false;
      }
      if (node.type === 'BinaryExpression' && node.operator === '**') return true;
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        const v = node[key];
        if (v && typeof v === 'object' && this._scanForBigIntPow(v, depth + 1)) return true;
      }
      return false;
    }

    /**
     * Extract a Literal IL node's actual numeric value as a native JS
     * BigInt, or null if it isn't a resolvable BigInt/numeric literal. The
     * IL builder represents a BigInt literal's value as either an actual
     * `bigint` primitive OR (when synthesized/coerced, e.g. for a
     * `bigint: true`-marked operand) a decimal string ending in "n" - see
     * _collectWideBigIntConstNames' call site for why this matters (a
     * literal's resultType alone doesn't distinguish a 64-bit mask from a
     * 128-bit one - both come through as 'uint64').
     * @param {object} node
     * @returns {bigint|null}
     */
    _bigIntLiteralValue(node) {
      if (!node || node.type !== 'Literal') return null;
      if (typeof node.value === 'bigint') return node.value;
      if (typeof node.value === 'string' && /^-?\d+n$/.test(node.value)) {
        try { return BigInt(node.value.slice(0, -1)); } catch (e) { return null; }
      }
      if (typeof node.bigint === 'string') {
        try { return BigInt(node.bigint.endsWith('n') ? node.bigint.slice(0, -1) : node.bigint); } catch (e) { return null; }
      }
      return null;
    }

    /**
     * Flat whole-file scan collecting every name declared as "const/let
     * NAME = A * B;" (a bare '*' BinaryExpression initializer) anywhere in
     * the file, paired with a second pass checking whether that same NAME
     * is ever used as the left operand of a literal ">> N" shift with N>=64
     * - see _wideProductVarNames' call site comment (GenerateFromAST) for
     * the mac/vmac.js widening-multiply idiom this detects.
     * @param {object} jsAst
     * @returns {Set<string>}
     */
    _collectWideProductVarNames(jsAst) {
      const productVarNames = new Set();
      const collectDecls = (node, seen) => {
        if (!node || typeof node !== 'object') return;
        if (seen.has(node)) return;
        seen.add(node);
        if (Array.isArray(node)) { for (const n of node) collectDecls(n, seen); return; }
        if (node.type === 'VariableDeclarator' && node.id && node.id.type === 'Identifier' &&
            node.init && node.init.type === 'BinaryExpression' && node.init.operator === '*') {
          productVarNames.add(node.id.name);
        }
        for (const key of Object.keys(node)) {
          if (key === 'parent' || key === '_parent') continue;
          collectDecls(node[key], seen);
        }
      };
      collectDecls(jsAst, new Set());
      if (productVarNames.size === 0) return new Set();

      const out = new Set();
      const collectUsages = (node, seen) => {
        if (!node || typeof node !== 'object') return;
        if (seen.has(node)) return;
        seen.add(node);
        if (Array.isArray(node)) { for (const n of node) collectUsages(n, seen); return; }
        if (node.type === 'BinaryExpression' && node.operator === '>>') {
          // The shift's left operand is frequently wrapped in a BigIntCast
          // IL node (e.g. "OpCodes.ShiftRn(product, 64n)" when `product`'s
          // resultType wasn't inferred as 'bigint' - see toBigIntOperand in
          // type-aware-transpiler.js's _transformOpCodesCall) - unwrap it to
          // find the underlying Identifier.
          let left = node.left;
          if (left && left.type === 'BigIntCast') left = left.argument;
          if (left && left.type === 'Identifier' && productVarNames.has(left.name)) {
            const shiftAmount = this._literalNumberValue(node.right);
            if (typeof shiftAmount === 'number' && shiftAmount >= 64) out.add(left.name);
          }
        }
        for (const key of Object.keys(node)) {
          if (key === 'parent' || key === '_parent') continue;
          collectUsages(node[key], seen);
        }
      };
      collectUsages(jsAst, new Set());
      return out;
    }

    /**
     * Flat whole-file scan for top-level "const NAME = <BigInt literal>;"
     * declarations whose value exceeds a native 64-bit width - see this
     * field's call site comment (transformBinaryExpression's '&'-of-
     * '*'/'+'/'-' case) for why.
     * @param {object} node
     * @param {Set<string>} [out]
     * @returns {Set<string>}
     */
    _collectWideBigIntConstNames(node, out) {
      out = out || new Set();
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const n of node) this._collectWideBigIntConstNames(n, out);
        return out;
      }
      if (node.type === 'VariableDeclarator' && node.id && node.id.type === 'Identifier' && node.init) {
        const v = this._bigIntLiteralValue(node.init);
        if (v !== null && (v > 0xFFFFFFFFFFFFFFFFn || v < 0n)) out.add(node.id.name);
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectWideBigIntConstNames(node[key], out);
      }
      return out;
    }

    /**
     * True if `node` is (or resolves, via _wideBigIntConstNames, to) a
     * BigInt mask/constant wider than a native 64-bit integer - e.g.
     * random/lehmer64.js's "MASK_128" (0xFFFF...FFFFn, 128 ones). See the
     * '&'-of-'*'/'+'/'-' case in transformBinaryExpression.
     * @param {object} node - raw (untransformed) JS/IL AST node
     * @returns {boolean}
     */
    _isWideBigIntMask(node) {
      if (!node) return false;
      const v = this._bigIntLiteralValue(node);
      if (v !== null) return v > 0xFFFFFFFFFFFFFFFFn || v < 0n;
      if (node.type === 'Identifier' && this._wideBigIntConstNames && this._wideBigIntConstNames.has(node.name)) return true;
      return false;
    }

    /**
     * Best-effort conservative upper bound on the number of significant
     * bits `node`'s value can occupy, or null if no useful bound can be
     * established - used to detect a "<<" whose RESULT provably exceeds
     * 64 bits even though its own literal shift amount is < 64 (e.g.
     * block/present.js's PRESENT-128 key schedule's "(roundCounter &
     * 0x1F) << 62", roundCounter masked to 5 bits: 5 + 62 = 67 > 64, or
     * PRESENT-80's "(key & ((1n<<19n)-1n)) << 61": 19 + 61 = 80 > 64) -
     * see the '<<' case in transformBinaryExpression. Fails closed (null)
     * whenever no operand structurally resolves to a bound, rather than
     * ever guessing - the '<<' case only widens an expression when this
     * POSITIVELY proves an overflow.
     * @param {object} node - raw (untransformed) JS/IL AST node
     * @returns {number|null}
     */
    _estimateMaxBitWidth(node) {
      if (!node) return null;
      if (node.type === 'BigIntCast') return this._estimateMaxBitWidth(node.argument);
      const lit = this._literalNumberValue(node);
      if (lit !== null && lit >= 0) return lit === 0 ? 1 : (Math.floor(Math.log2(lit)) + 1);
      // The "(1 << N) - 1" idiom (e.g. present.js's inline 19-bit
      // extraction mask "OpCodes.ShiftLn(BigInt(1), BigInt(19)) -
      // BigInt(1)") bounds its value to N bits.
      if (node.type === 'BinaryExpression' && node.operator === '-') {
        const rightVal = this._literalNumberValue(node.right);
        if (rightVal === 1 && node.left && node.left.type === 'BinaryExpression' && node.left.operator === '<<') {
          const baseVal = this._literalNumberValue(node.left.left);
          const shiftVal = this._literalNumberValue(node.left.right);
          if (baseVal === 1 && typeof shiftVal === 'number') return shiftVal;
        }
      }
      // "x & mask" is bounded by mask's own width regardless of x's
      // (unknown) width - AND can only clear bits, never set new ones.
      if (node.type === 'BinaryExpression' && node.operator === '&') {
        const rightW = this._estimateMaxBitWidth(node.right);
        const leftW = this._estimateMaxBitWidth(node.left);
        if (rightW !== null && leftW !== null) return Math.min(rightW, leftW);
        if (rightW !== null) return rightW;
        if (leftW !== null) return leftW;
      }
      if (node.type === 'Identifier' && this._narrowMaskVarWidths && this._narrowMaskVarWidths.has(node.name)) {
        return this._narrowMaskVarWidths.get(node.name);
      }
      return null;
    }

    /**
     * Flat whole-file scan for "const NAME = <expr>;" declarations (at ANY
     * nesting depth, unlike _collectWideBigIntConstNames's top-level-only
     * scan - see _estimateMaxBitWidth's doc comment for why a method-local
     * declaration matters here) whose value structurally resolves, via
     * _estimateMaxBitWidth, to a narrow bit-width bound. Takes the MAX
     * width across every declaration sharing a name when a name is reused
     * with different values in different scopes - fails safe in both
     * directions: this map only ever causes an "<<" that's already
     * numerically correct to additionally route through Math::BigInt
     * (never the reverse), so a conservatively-too-wide estimate costs a
     * little unneeded object-allocation overhead, never correctness.
     * @param {object} node
     * @param {Map<string, number>} [out]
     * @returns {Map<string, number>}
     */
    _collectNarrowMaskVarWidths(node, out) {
      out = out || new Map();
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const n of node) this._collectNarrowMaskVarWidths(n, out);
        return out;
      }
      if (node.type === 'VariableDeclarator' && node.id && node.id.type === 'Identifier' && node.init) {
        const w = this._estimateMaxBitWidth(node.init);
        if (typeof w === 'number') {
          const prev = out.get(node.id.name);
          out.set(node.id.name, prev === undefined ? w : Math.max(prev, w));
        }
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectNarrowMaskVarWidths(node[key], out);
      }
      return out;
    }

    /**
     * Plain numeric value of a small integer literal (BigInt-flavored or
     * not), or null if `node` isn't a resolvable literal - see
     * _estimateForLoopBound and the self-referential shift-accumulate
     * assignment case's "provably safe" guard (transformAssignmentExpression)
     * for why this is needed alongside _bigIntLiteralValue (which only
     * recognizes the BigInt-specific representations).
     * @param {object} node
     * @returns {number|null}
     */
    _literalNumberValue(node) {
      const v = this._bigIntLiteralValue(node);
      if (v !== null) return Number(v);
      if (node && node.type === 'Literal' && typeof node.value === 'number') return node.value;
      return null;
    }

    /**
     * Best-effort static estimate of the maximum number of times a C-style
     * "for (let i = 0; <test>; i++)" loop's body can execute, or null if
     * not determinable - used to tell a hot, always-safe, fixed-width byte-
     * accumulate loop (e.g. hash/sha512.js's message-schedule word-from-
     * bytes packing, "for (let i = 0; i < 8; ++i) value = (value<<8)|byte;"
     * - exactly 8 iterations * 8 bits = 64 bits, fits a native Perl integer
     * exactly) apart from a genuinely unbounded/wide one (e.g.
     * mac/poly1305.js's "for (i = bytes.length-1; i >= 0; i--)", up to 17
     * iterations = 136 bits) that actually needs the exact-precision
     * Math::BigInt routing - see its use in transformForStatement (which
     * pushes/pops _loopBoundStack around the body transform) and the self-
     * referential shift-accumulate assignment case in
     * transformAssignmentExpression (which consults the stack's top).
     * Only recognizes the common "i < N" / "i <= N" shape (N a literal),
     * optionally combined with a second, possibly-dynamic bound via "&&"
     * (e.g. random/lehmer64.js's seed()'s "i < seedBytes.length && i < 8" -
     * the smaller of the two, when at least one side is a literal, is a
     * valid upper bound regardless of the other side's runtime value).
     * Deliberately conservative: returns null (meaning "assume unbounded/
     * unsafe") for anything else, rather than guessing.
     * @param {object} test - raw (untransformed) JS/IL test expression node
     * @returns {number|null}
     */
    _estimateForLoopBound(test) {
      if (!test) return null;
      if (test.type === 'LogicalExpression' && test.operator === '&&') {
        const l = this._estimateForLoopBound(test.left);
        const r = this._estimateForLoopBound(test.right);
        if (l !== null && r !== null) return Math.min(l, r);
        return l !== null ? l : r;
      }
      if (test.type === 'BinaryExpression' && (test.operator === '<' || test.operator === '<=')) {
        const n = this._literalNumberValue(test.right);
        if (typeof n === 'number') return test.operator === '<=' ? n + 1 : n;
      }
      return null;
    }

    /**
     * Recursively walk the whole (pre-transform) JS AST looking for
     * "this.FIELD = 'literal'" / "this.FIELD = someOtherStringExpr" field
     * initializations (e.g. classical-cipher alphabet constants like
     * "this.ALPHABET = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';"). See the call site's
     * comment (this.stringFieldNames) for why this exists: isStringType()'s
     * structural/resultType checks don't reach through a cross-object field
     * chain like "this.algorithm.ALPHABET", so a computed index into one
     * fell through to array/hash dereferencing instead of substr(). Mirrors
     * _collectArrayFieldNames's trade-off - a flat, unscoped, whole-file
     * name scan - deliberately applied to *any* object the field is read
     * through, not just same-class "this.X" access.
     * @param {object} node
     * @param {Set<string>} [out]
     * @returns {Set<string>}
     */
    _collectStringFieldNames(node, out) {
      out = out || new Set();
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const item of node) this._collectStringFieldNames(item, out);
        return out;
      }

      // Structurally-a-string right-hand side check, deliberately simpler
      // than the full isStringType() (which relies on per-transform state
      // like this.stringVariables/classStringGetters that doesn't exist yet
      // during this pre-transform pre-scan) - literals and the common
      // string-producing call/operator shapes are enough to catch the
      // constant-alphabet-table pattern this exists for.
      const looksLikeString = (n) => {
        if (!n) return false;
        if (n.type === 'Literal' && typeof n.value === 'string') return true;
        if (n.resultType === 'string' || n.resultType === 'String') return true;
        if (n.type === 'BinaryExpression' && n.operator === '+')
          return looksLikeString(n.left) || looksLikeString(n.right);
        if (n.type === 'CallExpression' && n.callee?.property) {
          const m = n.callee.property.name || n.callee.property.value;
          if (['substring', 'substr', 'toUpperCase', 'toLowerCase', 'trim', 'trimStart',
               'trimEnd', 'charAt', 'concat', 'repeat', 'replace', 'replaceAll',
               'padStart', 'padEnd', 'join'].includes(m)) return true;
        }
        return false;
      };

      if (node.type === 'AssignmentExpression' && node.operator === '=') {
        const left = node.left;
        const isThisProp = left && (left.type === 'ThisPropertyAccess' ||
          (left.type === 'MemberExpression' && !left.computed && left.object?.type === 'ThisExpression'));
        if (isThisProp) {
          const fieldName = typeof left.property === 'string'
            ? left.property
            : (left.property?.name || left.property?.value);
          if (fieldName && looksLikeString(node.right)) out.add(fieldName);
        }
      }
      if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' && looksLikeString(node.init))
        out.add(node.id.name);

      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectStringFieldNames(node[key], out);
      }
      return out;
    }

    /**
     * Same idea as _collectStringFieldNames, but for "this.FIELD[i] =
     * 'literal'"/"this.FIELD[i] = someStringExpr" - a *computed* (indexed)
     * assignment into an array field whose ELEMENTS are strings, not the
     * field itself (e.g. classical/enigma.js's "this.rotorWirings[i] =
     * this.ROTOR_I;" where ROTOR_I is a 26-letter wiring-sequence string
     * constant, or classical/jefferson-wheel.js's per-wheel letter
     * sequences). Lets a *further* index into one of these elements
     * ("this.rotorWirings[rotorIndex][adjustedInput]") be recognized by
     * isStringType's computed-MemberExpression case as indexing into a
     * string (-> substr(), single char) rather than the array-of-arrays
     * default (-> "$x->[$i]", which dies "Can't use string ... as an ARRAY
     * ref" since the element actually held there is a plain string).
     * @param {object} node
     * @param {Set<string>} [out]
     * @returns {Set<string>}
     */
    _collectArrayOfStringFieldNames(node, out) {
      out = out || new Set();
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const item of node) this._collectArrayOfStringFieldNames(item, out);
        return out;
      }
      const looksLikeString = (n) => {
        if (!n) return false;
        if (n.type === 'Literal' && typeof n.value === 'string') return true;
        if (n.resultType === 'string' || n.resultType === 'String') return true;
        if (n.type === 'BinaryExpression' && n.operator === '+')
          return looksLikeString(n.left) || looksLikeString(n.right);
        if (n.type === 'CallExpression' && n.callee?.property) {
          const m = n.callee.property.name || n.callee.property.value;
          if (['substring', 'substr', 'toUpperCase', 'toLowerCase', 'trim', 'trimStart',
               'trimEnd', 'charAt', 'concat', 'repeat', 'replace', 'replaceAll',
               'padStart', 'padEnd', 'join'].includes(m)) return true;
        }
        // "this.rotorWirings[i] = this.ROTOR_I;" - the assigned value is
        // itself just a this-field reference to a (separately declared)
        // string constant - this.stringFieldNames (a whole-file pre-scan
        // run just before this one - see this.arrayOfStringFieldNames'
        // call site) already knows about those.
        if (n.type === 'ThisPropertyAccess' && n.property && this.stringFieldNames?.has(n.property))
          return true;
        return false;
      };
      if (node.type === 'AssignmentExpression' && node.operator === '=' &&
          node.left?.type === 'MemberExpression' && node.left.computed) {
        const base = node.left.object;
        const isThisProp = base && (base.type === 'ThisPropertyAccess' ||
          (base.type === 'MemberExpression' && !base.computed && base.object?.type === 'ThisExpression'));
        if (isThisProp) {
          const fieldName = typeof base.property === 'string'
            ? base.property
            : (base.property?.name || base.property?.value);
          if (fieldName && looksLikeString(node.right)) out.add(fieldName);
        }
      }

      // "this.wheels = [...]" / "this.wheels = this.defaultWheels.slice(...)"
      // / "get defaultWheels() { return [...]; }" - a *whole-field* (not
      // per-element) assignment/getter-return whose value is structurally
      // an array of strings (a literal array of all-string elements, or an
      // array-preserving method call - slice/concat/filter/map/sort/reverse -
      // on an expression that's itself already known to be one, chasing
      // through a same-file this-field/getter reference). Classical/
      // jefferson-wheel.js builds its per-wheel array this way (from a
      // getter returning a literal array of 26-letter wheel-sequence
      // strings) rather than the element-by-element "this.X[i] = <string>"
      // pattern the check above targets - needs its own detection since
      // there's no per-element assignment site to see at all. Called in a
      // fixed-point loop (see this.arrayOfStringFieldNames's call site) so
      // "this.wheels = this.defaultWheels.slice(...)" resolves regardless
      // of whether the defaultWheels getter was scanned before or after it
      // in file order.
      const looksLikeArrayOfStrings = (n) => {
        if (!n) return false;
        if (n.type === 'ArrayExpression' && n.elements && n.elements.length > 0 &&
            n.elements.every(e => e && e.type === 'Literal' && typeof e.value === 'string'))
          return true;
        if (n.type === 'CallExpression' && n.callee?.type === 'MemberExpression' && !n.callee.computed) {
          const m = n.callee.property?.name || n.callee.property?.value;
          if (['slice', 'concat', 'filter', 'map', 'sort', 'reverse'].includes(m))
            return looksLikeArrayOfStrings(n.callee.object);
        }
        // The IL pass lowers "arr.slice(...)" to a dedicated ArraySlice
        // node (not a plain CallExpression) *before* this pre-scan ever
        // runs - e.g. classical/jefferson-wheel.js's "this.defaultWheels.
        // slice(0, this.wheelCount)" - so the generic CallExpression case
        // just above never actually matches this codebase's real usage;
        // this is the shape that does.
        if (n.type === 'ArraySlice' && n.array) return looksLikeArrayOfStrings(n.array);
        if (n.type === 'ThisPropertyAccess' && n.property) return out.has(n.property);
        if (n.type === 'MemberExpression' && !n.computed && n.object?.type === 'ThisExpression') {
          const p = n.property?.name || n.property?.value;
          return !!p && out.has(p);
        }
        return false;
      };
      if (node.type === 'AssignmentExpression' && node.operator === '=') {
        const left = node.left;
        const isThisProp = left && (left.type === 'ThisPropertyAccess' ||
          (left.type === 'MemberExpression' && !left.computed && left.object?.type === 'ThisExpression'));
        if (isThisProp && looksLikeArrayOfStrings(node.right)) {
          const fieldName = typeof left.property === 'string'
            ? left.property
            : (left.property?.name || left.property?.value);
          if (fieldName) out.add(fieldName);
        }
      }
      if (node.type === 'MethodDefinition' && node.kind === 'get') {
        const returns = [];
        this._collectReturnStatements(node.value?.body, returns);
        if (returns.length > 0 && returns.every(r => r.argument && looksLikeArrayOfStrings(r.argument)) && node.key?.name)
          out.add(node.key.name);
      }

      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectArrayOfStringFieldNames(node[key], out);
      }
      return out;
    }

    /**
     * Recursively walk the whole (IL) AST collecting every local variable
     * or this-field name ever initialized/assigned from a ".CreateInstance(
     * ...)" call - the codebase-wide pattern for obtaining a sub-cipher/hash
     * instance (const desInstance = this._desAlgorithm.CreateInstance(...);
     * this.blockCipher = AlgorithmFramework.Find(name).CreateInstance();
     * ...). Feeds _isCipherInstanceRef() so its "is this a cross-file cipher
     * instance whose .key must go through an accessor" check isn't limited
     * to names ending in "cipher" (desInstance, sha512, hmac, ... don't).
     * @param {object} node
     * @param {Set<string>} [out]
     * @returns {Set<string>}
     */
    _collectCreateInstanceVarNames(node, out) {
      out = out || new Set();
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const item of node) this._collectCreateInstanceVarNames(item, out);
        return out;
      }

      const isCreateInstanceCall = (n) => {
        if (!n) return false;
        if (n.type === 'CallExpression' && n.callee?.type === 'MemberExpression') {
          const m = n.callee.property?.name || n.callee.property?.value;
          return m === 'CreateInstance';
        }
        if (n.type === 'ThisMethodCall' && n.method === 'CreateInstance') return true;
        return false;
      };

      if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' && isCreateInstanceCall(node.init))
        out.add(node.id.name);

      if (node.type === 'AssignmentExpression' && node.operator === '=' && isCreateInstanceCall(node.right)) {
        if (node.left?.type === 'Identifier') out.add(node.left.name);
        else if (node.left?.type === 'ThisPropertyAccess') { if (node.left.property) out.add(node.left.property); }
        else if (node.left?.type === 'MemberExpression' && !node.left.computed && node.left.object?.type === 'ThisExpression') {
          const fieldName = node.left.property?.name || node.left.property?.value;
          if (fieldName) out.add(fieldName);
        }
      }

      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectCreateInstanceVarNames(node[key], out);
      }
      return out;
    }

    /**
     * Recursively walk the whole (IL) AST collecting every local variable
     * name ever initialized directly from a "Math.imul(a, b)" call (IL
     * 'MathCall' node with method 'imul') - feeds the 'Floor' IL case's
     * sign-correction (see its call site's doc comment, and
     * algorithms/random/mwc.js's 128-bit-via-32-bit-halves multiply-with-
     * carry step, for the full explanation of why this specific value
     * needs to be tracked).
     * @param {object} node
     * @param {Set<string>} [out]
     * @returns {Set<string>}
     */
    _collectImulResultVarNames(node, out) {
      out = out || new Set();
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const item of node) this._collectImulResultVarNames(item, out);
        return out;
      }

      const isImulCall = (n) => n && n.type === 'MathCall' && n.method === 'imul';

      if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' && isImulCall(node.init))
        out.add(node.id.name);

      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectImulResultVarNames(node[key], out);
      }
      return out;
    }

    /**
     * Walk down a (raw, untransformed) chain of "+" BinaryExpression nodes
     * collecting every leaf operand that is either a direct "Math.imul(a,
     * b)" call or a reference to a local variable previously assigned from
     * one (_imulResultVarNames) - see the 'Floor' IL case's doc comment for
     * why these specific operands need special handling inside a
     * floor-divide-by-2**32.
     * @param {object} node
     * @param {object[]} out
     */
    _collectImulSumOperands(node, out) {
      if (!node) return;
      if (node.type === 'BinaryExpression' && node.operator === '+') {
        this._collectImulSumOperands(node.left, out);
        this._collectImulSumOperands(node.right, out);
        return;
      }
      if (node.type === 'MathCall' && node.method === 'imul') { out.push(node); return; }
      if (node.type === 'Identifier' && this._imulResultVarNames && this._imulResultVarNames.has(node.name)) { out.push(node); return; }
    }

    /**
     * Detect nested "function foo() {...}" declarations (see
     * _buildFunctionSub's isNested doc comment) whose NAME is reused across
     * more than one method of the same class - e.g. hash/gimli24-hash.js's
     * Gimli24HashInstance, whose "_absorb()" AND "Result()" methods each
     * declare their own local "function stateToBytes() {...}"/"function
     * bytesToState() {...}" helper closing over that method's own $self/
     * $stateBytes/$j/$word locals. JS scopes a nested function declaration
     * to its enclosing function body, so the two are completely unrelated;
     * Perl's "sub NAME {...}" is instead resolved at COMPILE time as a
     * single package-global symbol regardless of lexical nesting - the
     * second textual declaration silently REDEFINES the first (a
     * "Subroutine ... redefined" warning), so by the time either method
     * actually runs, "stateToBytes()" always means whichever one was
     * declared LAST in the file - closing over the WRONG method's locals
     * (never initialized for this call). This produced "Use of
     * uninitialized value in bitwise and"/silently-wrong output, not a
     * hard error, making it easy to miss. Returns a
     * Map<"methodName functionName", uniqueRenamedName> covering only the
     * colliding names (a name used in just one method needs no rename) -
     * consulted by _buildFunctionSub (declaration site) and
     * transformCallExpression (call sites) via currentMethodName, so each
     * method gets its own uniquely-named copy of the helper instead of one
     * shared (and silently wrong) package-global sub.
     * @param {object} classBodyMembers - array of ClassBody member nodes
     * @returns {Map<string, string>}
     */
    _collectNestedFunctionRenames(classBodyMembers) {
      const nameToMethods = new Map(); // funcName -> Set<methodName>
      const collectNestedNames = (node, methodName, out) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { for (const n of node) collectNestedNames(n, methodName, out); return; }
        if (node.type === 'FunctionDeclaration' && node.id?.name) out.add(node.id.name);
        for (const key of Object.keys(node)) {
          if (key === 'parent' || key === '_parent') continue;
          collectNestedNames(node[key], methodName, out);
        }
      };
      for (const member of (classBodyMembers || [])) {
        if (member.type !== 'MethodDefinition' || !member.value?.body) continue;
        const methodName = member.key?.name;
        if (!methodName) continue;
        const namesHere = new Set();
        collectNestedNames(member.value.body, methodName, namesHere);
        for (const name of namesHere) {
          if (!nameToMethods.has(name)) nameToMethods.set(name, new Set());
          nameToMethods.get(name).add(methodName);
        }
      }
      const renames = new Map();
      for (const [funcName, methods] of nameToMethods) {
        if (methods.size < 2) continue;
        for (const methodName of methods) {
          renames.set(methodName + ' ' + funcName, funcName + '__' + methodName);
        }
      }
      return renames;
    }

    /**
     * Resolve the Perl sub name a nested "function foo() {...}" declaration/
     * call site must actually use, given which class method it lexically
     * lives in - see _collectNestedFunctionRenames' doc comment. Falls back
     * to the plain original name whenever there's no collision (the common
     * case) or when called outside any method (currentMethodName null).
     * @param {string} funcName - the original JS function name
     * @returns {string}
     */
    _resolveNestedFunctionName(funcName) {
      if (!this.currentMethodName) return funcName;
      const key = this.currentMethodName + ' ' + funcName;
      return this.currentClassNestedFuncRenames.has(key)
        ? this.currentClassNestedFuncRenames.get(key)
        : funcName;
    }

    /**
     * Recursively collect the names of every nested "function foo() {...}"
     * declaration reachable from `node` WITHOUT crossing into another
     * function's own scope (a nested FunctionDeclaration's own body is
     * recorded but not descended into; a FunctionExpression/
     * ArrowFunctionExpression/MethodDefinition boundary stops the walk
     * entirely) - i.e. every name JS's own function-scoped hoisting would
     * make visible throughout the CURRENT enclosing function/method body,
     * however deeply nested inside if/for/while/switch/block statements it
     * textually sits. See _buildFunctionSub's doc comment and this
     * predicate's use in transformMethodDefinition/transformFunctionExpression/
     * _buildFunctionSub's own top-level-function case (_hoistNestedFunctionDeclVars)
     * for why the ENCLOSING body needs to know these names up front, before
     * transforming any of its statements: permutation/simpira-v2.js's
     * aesInvMixColumns() declares "function mul14(p) { ...mulX(p)... }"
     * BEFORE "function mulX(p) {...}" later in the SAME for-loop body - JS
     * hoisting makes this forward reference to mulX work fine, and the
     * previous named-"sub mulX {...}"-per-declaration approach (resolved at
     * Perl COMPILE time regardless of order) happened to preserve that
     * property, but a naive "my $mulX = sub {...}" at mulX's own (later)
     * textual position does NOT - mul14's closure body would reference a
     * $mulX that doesn't exist as a declared lexical yet at the point
     * mul14's own anon-sub is compiled, dying "Global symbol $mulX requires
     * explicit package name".
     * @param {object} node
     * @param {Set<string>} [out]
     * @returns {Set<string>}
     */
    _collectNestedFunctionDeclNames(node, out) {
      out = out || new Set();
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const n of node) this._collectNestedFunctionDeclNames(n, out);
        return out;
      }
      if (node.type === 'FunctionDeclaration') {
        if (node.id?.name) out.add(node.id.name);
        return out; // its own body is a separate scope - don't descend
      }
      if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression' ||
          node.type === 'ArrowFunction' || node.type === 'MethodDefinition') {
        return out; // separate scope boundary - don't descend
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._collectNestedFunctionDeclNames(node[key], out);
      }
      return out;
    }

    /**
     * Prepend a "my $name;" pre-declaration (through _resolveNestedFunctionName,
     * so a renamed colliding nested function's Perl variable matches) for
     * every nested function declaration name reachable from `rawBody` (see
     * _collectNestedFunctionDeclNames' doc comment for why) to
     * `transformedBlock`'s own statement list - called once, right after
     * transforming a genuine function-scope body (a class method, a
     * top-level "function foo() {...}", or a function/arrow expression),
     * NOT for every intervening if/for/while/block, mirroring JS's actual
     * function-scoped (not block-scoped) hoisting. _buildFunctionSub's
     * nested-declaration case (isNested) itself only ASSIGNS to the
     * already-declared lexical at its own textual position ("$name = sub
     * {...};", not "my $name = sub {...};"), so re-running that assignment
     * on every entry into the enclosing body still creates a fresh closure
     * each time (fixing hash/gimli24-hash.js's stale-closure bug - see
     * _buildFunctionSub's doc comment) while the pre-declaration here makes
     * a forward reference among sibling nested functions resolve regardless
     * of their declaration order (fixing this doc comment's simpira-v2.js
     * case, permutation/simpira-v2.js's mul14-calls-mulX-declared-later).
     * @param {object} rawBody - the raw (untransformed) JS/IL function body
     * @param {object} transformedBlock - the PerlBlock already built from it
     */
    _hoistNestedFunctionDeclVars(rawBody, transformedBlock) {
      if (!transformedBlock) return;
      const names = this._collectNestedFunctionDeclNames(rawBody);
      if (names.size === 0) return;
      const decls = [];
      for (const name of names) {
        const emittedName = this._resolveNestedFunctionName(name);
        decls.push(new PerlVarDeclaration('my', emittedName, '$', null));
      }
      transformedBlock.statements.unshift(...decls);
    }

    /**
     * Transform a genuine function-scope body (a class method's, a
     * top-level "function foo() {...}"'s, a nested-declaration's own, or a
     * function/arrow expression's) - the single shared entry point that
     * combines _collectNestedFunctionDeclNames/_hoistNestedFunctionDeclVars
     * with SCOPED registration of each direct nested-declaration name into
     * codeRefVariables/nestedFunctionNames (so calls/value-reads anywhere
     * in this body - including a FORWARD reference textually preceding the
     * declaration itself, e.g. permutation/simpira-v2.js's mul14-before-
     * mulX - resolve to "$name"/"$name->(...)" the same way an ordinary
     * already-assigned closure variable does; see _buildFunctionSub's doc
     * comment).
     *
     * Registration is undone once this body finishes transforming (unlike
     * functionNames, which stays permanently set - seeing the plain NAME
     * again elsewhere in the file, outside this body, should NOT still
     * read as "$name->(...)") - kdf/argon2.js declares TWO completely
     * unrelated top-level "function G(...)" (one nested inside its own
     * blake2b() helper, one genuinely top-level), sharing nothing but a
     * name; without unscoping, the FIRST (nested) G's registration leaked
     * for the rest of the whole-file transform, so a later, ENTIRELY
     * unrelated top-level function's own call to the SECOND (real
     * top-level, package-sub) G was wrongly rewritten to "$G->(...)"
     * (undefined lexical - "Global symbol $G requires explicit package
     * name") instead of the correct "main::G(...)"/bare "G(...)".
     * @param {object} rawBody - the raw (untransformed) JS/IL function body
     * @returns {object|null} PerlBlock
     */
    _transformFunctionScopeBody(rawBody) {
      if (!rawBody) return null;
      const names = this._collectNestedFunctionDeclNames(rawBody);
      const added = [];
      for (const name of names) {
        if (!this.codeRefVariables.has(name)) {
          this.codeRefVariables.add(name);
          this.nestedFunctionNames.add(name);
          this.functionNames.add(name);
          this.registerVariableType(name, '$');
          added.push(name);
        }
      }

      const block = this.transformBlockStatement(rawBody);
      this._hoistNestedFunctionDeclVars(rawBody, block);

      for (const name of added) {
        this.codeRefVariables.delete(name);
        this.nestedFunctionNames.delete(name);
      }

      return block;
    }

    /**
     * Extract fields from constructor's this.x = y assignments
     */
    extractFieldsFromConstructor(node) {
      const fields = [];

      if (!node.value || !node.value.body || node.value.body.type !== 'BlockStatement')
        return fields;

      for (const stmt of node.value.body.body) {
        if (this.isThisPropertyAssignment(stmt)) {
          const expr = stmt.expression;
          const propName = expr.left.property.name || expr.left.property.value;
          const value = expr.right;

          const field = new PerlField(propName);
          field.defaultValue = this.transformExpression(value);

          fields.push(field);
        }
      }

      return fields;
    }

    /**
     * Detect the ES5 runtime accessor-definition idiom
     * "Object.defineProperty(this, '<name>', { get: ..., set: ..., ... })"
     * inside a constructor body (block/rc.js's RC2Instance is the sole user
     * of this pattern across the whole algorithms tree - real ES6 class
     * "get x() {}"/"set x(v) {}" members are already handled by the
     * class-member loop above via transformAccessorPair, but this call-based
     * form is just an ordinary statement, invisible to that loop; without
     * this it falls through to the generic CallExpression path and gets
     * transpiled into nonsense Perl - a method call on a package literally
     * named "Object").
     * @param {object} stmt
     * @returns {{name: string, getterFn: object|null, setterFn: object|null}|null}
     */
    _matchDefinePropertyStatement(stmt) {
      if (!stmt || stmt.type !== 'ExpressionStatement') return null;
      const expr = stmt.expression;
      if (!expr || expr.type !== 'CallExpression') return null;
      const callee = expr.callee;
      if (!callee || callee.type !== 'MemberExpression') return null;
      if (callee.object?.name !== 'Object') return null;
      const calleeProp = callee.property?.name || callee.property?.value;
      if (calleeProp !== 'defineProperty') return null;

      const args = expr.arguments || [];
      if (args.length < 3 || args[0].type !== 'ThisExpression') return null;

      const nameArg = args[1];
      const name = nameArg?.value ?? nameArg?.name;
      if (typeof name !== 'string') return null;

      const descriptor = args[2];
      // The IL pass represents an object literal as 'ObjectLiteral' (raw
      // ESTree would say 'ObjectExpression') with 'ObjectProperty' entries
      // whose .key is a bare string (not a nested Identifier/Literal node).
      if (!descriptor || (descriptor.type !== 'ObjectExpression' && descriptor.type !== 'ObjectLiteral') || !descriptor.properties) return null;

      let getterFn = null, setterFn = null;
      for (const prop of descriptor.properties) {
        const key = typeof prop.key === 'string' ? prop.key : (prop.key?.name ?? prop.key?.value);
        if (key === 'get') getterFn = prop.value;
        else if (key === 'set') setterFn = prop.value;
      }
      if (!getterFn && !setterFn) return null;

      return { name, getterFn, setterFn };
    }

    /**
     * Normalize a getter/setter function (FunctionExpression or
     * ArrowFunctionExpression, possibly with a concise/expression body) into
     * the {value: {params, body: {body: [...]}}} shape transformAccessorPair
     * expects (mirroring a real MethodDefinition's own shape).
     * @param {object|null} fnNode
     * @returns {{value: {params: object[], body: {body: object[]}}}|null}
     */
    _wrapAccessorFunction(fnNode) {
      if (!fnNode) return null;
      let body = fnNode.body;
      if (!body || body.type !== 'BlockStatement') {
        // Concise arrow body ("() => this._x") - synthesize an implicit return.
        body = { type: 'BlockStatement', body: [{ type: 'ReturnStatement', argument: body }] };
      }
      return { value: { params: fnNode.params || [], body } };
    }

    /**
     * Check if a statement is a this.property = value assignment
     */
    isThisPropertyAssignment(stmt) {
      if (stmt.type !== 'ExpressionStatement') return false;
      const expr = stmt.expression;
      if (expr.type !== 'AssignmentExpression') return false;
      if (expr.left.type !== 'MemberExpression') return false;
      return expr.left.object.type === 'ThisExpression';
    }

    /**
     * Transform a constructor to BUILD/ADJUST
     */
    transformConstructor(node) {
      const ctor = new PerlSub(this.options.useModernClass ? 'ADJUST' : 'BUILD');
      ctor.isMethod = true;
      ctor.useSignatures = this.options.addSignatures;

      // Parameters
      if (node.value && node.value.params) {
        // Add $self as first parameter if not using modern class
        if (!this.options.useModernClass) {
          ctor.parameters.push(new PerlParameter('self', '$'));
        }

        for (const param of node.value.params) {
          // Handle parameter with default value
          // IL AST: Identifier with defaultValue property
          // Raw AST: AssignmentPattern with left.name and right
          let paramName, defaultValue = null;
          if (param.type === 'AssignmentPattern') {
            paramName = param.left.name;
            defaultValue = this.transformExpression(param.right);
          } else if (param.defaultValue) {
            // IL AST puts default on the Identifier node
            paramName = param.name;
            defaultValue = this.transformExpression(param.defaultValue);
          } else {
            paramName = param.name;
            // For BUILD/ADJUST methods, make all parameters optional with undef default
            // This allows calling BUILD() without arguments for initialization
            defaultValue = PerlLiteral.Undef();
          }
          // Always use $ for function parameters to avoid slurpy issues
          ctor.parameters.push(new PerlParameter(paramName, '$', null, defaultValue));
          // IMPORTANT: Register parameter as scalar so it's used correctly in body
          this.registerVariableType(paramName, '$');
        }
      } else if (!this.options.useModernClass) {
        // No params, but still add $self
        ctor.parameters.push(new PerlParameter('self', '$'));
      }

      // Body - rewrite/drop the super(...) call, since 'new' no longer
      // chains through SUPER::new for field initialization (see
      // transformSuperCallsForBuild).
      if (node.value && node.value.body) {
        let filteredBody = this.transformSuperCallsForBuild(node.value.body);
        // Drop Object.defineProperty(this, name, {get,set}) statements - they
        // were already turned into real accessor subs above (see
        // _matchDefinePropertyStatement), so leaving them in would also emit
        // them a second time via the generic CallExpression path.
        if (filteredBody && filteredBody.body) {
          const stripped = filteredBody.body.filter(s => !this._matchDefinePropertyStatement(s));
          if (stripped.length !== filteredBody.body.length) {
            filteredBody = Object.assign({}, filteredBody, { body: stripped });
          }
        }
        ctor.body = this.transformBlockStatement(filteredBody);
      }

      return ctor;
    }

    /**
     * Rewrite the super(...) call inside a constructor body that is being
     * converted to a BUILD method.
     *
     * 'new' constructs a plain blessed hashref and calls only the leaf
     * class's own BUILD(@_) - it no longer chains through SUPER::new(@_),
     * because the framework base classes have no meaningful state to set
     * up and blindly forwarding constructor args into their generic
     * "$self = { @_ }" stub corrupts positional args into bogus hash keys.
     *
     * Real (locally-defined) parent classes still need their field
     * initialization to run, though, so when the base class is one we
     * know has its own constructor-derived BUILD (tracked in
     * this.classesWithConstructor), the super(args) call is rewritten to
     * $self->SUPER::BUILD(args) - preserving the exact arguments the JS
     * super() call passed, so multi-level chains like
     * "class Foo extends Base { constructor(variant) { super(variant); ... } }"
     * still initialize Base's fields correctly.
     *
     * When the base class is an AlgorithmFramework.js instance-interface
     * stub (IAlgorithmInstance and everything that extends it -
     * IBlockCipherInstance, IHashFunctionInstance, ...), those interfaces
     * are never transpiled themselves (they live in AlgorithmFramework.js,
     * not the algorithm source file), so they can never appear in
     * classesWithConstructor - but IAlgorithmInstance's constructor sets
     * fields (algorithm, isInverse, inputBuffer) that virtually every
     * instance class's Feed()/Result()/accessors rely on. Since 'new' no
     * longer chains through the framework stub's generic new(@_), that
     * contract is replicated here directly from the exact super(...) call
     * arguments, instead of being silently lost.
     *
     * Any other framework/unknown base class's super() call is dropped
     * entirely - those stubs carry no meaningful state.
     */
    transformSuperCallsForBuild(body) {
      if (!body || !body.body) return body;

      const baseClass = this.currentClass?.baseClass;
      const parentHasBuild = baseClass && this.classesWithConstructor.has(baseClass);
      const parentIsInstanceStub = baseClass && !parentHasBuild && /^I\w*Instance$/.test(baseClass);

      const rewritten = [];
      for (const stmt of body.body) {
        if (stmt.type === 'ExpressionStatement') {
          const expr = stmt.expression;
          const isSuperCall = expr && (
            expr.type === 'ParentConstructorCall' ||
            (expr.type === 'CallExpression' && expr.callee && expr.callee.type === 'Super')
          );
          if (isSuperCall) {
            if (parentHasBuild) {
              rewritten.push({
                type: 'ExpressionStatement',
                expression: { type: 'ParentBuildCall', arguments: expr.arguments || [] }
              });
            } else if (parentIsInstanceStub) {
              const args = expr.arguments || [];
              const thisAssign = (property, value) => ({
                type: 'ExpressionStatement',
                expression: {
                  type: 'AssignmentExpression', operator: '=',
                  left: { type: 'ThisPropertyAccess', property },
                  right: value
                }
              });
              rewritten.push(thisAssign('algorithm', args[0] || { type: 'Literal', value: null }));
              rewritten.push(thisAssign('isInverse', args[1] || { type: 'Literal', value: false }));
              rewritten.push(thisAssign('inputBuffer', { type: 'ArrayExpression', elements: [] }));
            }
            // else: drop - no parent BUILD/state to replicate
            continue;
          }
        }
        rewritten.push(stmt);
      }

      return { ...body, body: rewritten };
    }

    /**
     * Transform a method definition
     */
    transformMethodDefinition(node) {
      const methodName = node.key.name;
      const method = new PerlSub(methodName);
      method.isMethod = true;
      method.useSignatures = this.options.addSignatures;

      const prevInMethod = this.inMethod;
      this.inMethod = true;

      // See _collectNestedFunctionRenames' doc comment - lets a nested
      // "function foo() {...}" declaration/call site inside THIS method's
      // body know which (possibly-renamed) copy of a same-named helper
      // declared in a DIFFERENT sibling method it must NOT be confused with.
      const prevMethodName = this.currentMethodName;
      this.currentMethodName = methodName;

      // this.stringVariables is a flat, name-keyed Set with NO method-level
      // scoping - transformLetStatement/the two blocks below add a bare
      // variable/parameter NAME whenever ITS initializer/usage structurally
      // looks like a string, so later same-named Identifier references
      // (isStringType) recognize it too within that variable's own method.
      // Without this snapshot/restore, that "add" is never undone once the
      // method finishes: a later, completely unrelated method in the same
      // (or another) class with a same-named parameter silently inherits
      // the earlier method's string-ness. E.g. block/ff.js's FF3Instance
      // has TWO unrelated methods each with their own "plaintext" parameter
      // - "_encrypt(plaintext)" genuinely passes it to a string-consuming
      // helper (correctly inferred string), but the dummy "_aesEncrypt(
      // plaintext)" treats its own same-named parameter as a byte ARRAY
      // ("plaintext.length"/"plaintext[i]") - the leaked string-ness made
      // its ".length"/"[i]" wrongly emit length($x)/substr($x,$i,1) instead
      // of scalar(@$x)/$x->[$i], silently reading garbage single-character
      // "bytes" into later integer arithmetic. Saving a COPY here and
      // restoring it (rather than clearing outright) still preserves any
      // module/top-level string constant this set may have picked up
      // *before* any method ran.
      const prevStringVariables = new Set(this.stringVariables);

      // Add $self parameter if not using modern class
      if (!this.options.useModernClass && !node.static) {
        method.parameters.push(new PerlParameter('self', '$'));
      }

      // Parameters
      // IMPORTANT: Always use $ for parameters to avoid slurpy issues
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          // Handle parameter with default value: function(x = 5) => sub($x = 5)
          let paramName, defaultValue = null;
          if (param.type === 'AssignmentPattern') {
            paramName = param.left.name;
            defaultValue = this.transformExpression(param.right);
          } else if (param.defaultValue) {
            paramName = param.name;
            defaultValue = this.transformExpression(param.defaultValue);
          } else {
            paramName = param.name;
            // JS allows calling with fewer args than declared (missing ones become undefined);
            // Perl signatures require an explicit default to permit that.
            defaultValue = PerlLiteral.Undef();
          }
          // Always use $ for function parameters
          method.parameters.push(new PerlParameter(paramName, '$', null, defaultValue));
          // IMPORTANT: Register parameter as scalar so it's used correctly in body
          this.registerVariableType(paramName, '$');
        }
      }

      // HOTP/TOTP/SP800-108-* HMAC fallback methods (e.g. hotp.js's
      // "_hmacSHA1(key, message)", totp.js's generic "_hmac(key, message)")
      // all follow the identical JS shape: try Node's real "crypto"
      // module first, fall back to a (nonexistent - OpCodes.HMAC is not
      // and never has been a real OpCodes method) "OpCodes.HMAC" check,
      // then throw "Cannot compute HMAC...: No crypto library available".
      // The shared/frozen type-aware-transpiler.js's own
      // _stripRequireGuardedBlocks pass (outside this plugin's file
      // ownership) deletes the entire "if (typeof require !== 'undefined')
      // { try { ... } catch {} }" guard before this transformer ever sees
      // the AST - correct for the common case where a working non-Node
      // fallback follows, but here it silently leaves ONLY the dead-end
      // throw behind (verified by dumping the actual transpiled output:
      // the method body collapsed to a stray "{ 1; }" placeholder
      // immediately followed by the die). Since the JS side legitimately
      // depends on a real crypto backend (there is no non-Node fallback),
      // every one of these methods always threw in Perl - the actual
      // "Cannot compute HMAC" errors under kdf/sp800-108-*.js and
      // special/hotp.js|totp.js. Recognize the surviving shape (method
      // name plus the telltale error text still present in the ORIGINAL
      // JS body, since we can't rely on anything the IL already deleted)
      // and synthesize a real implementation via Perl's Digest::SHA
      // instead, bypassing the (already-eliminated) generic body
      // transform entirely.
      if (this._isHmacFallbackMethod(methodName, node)) {
        method.body = this._buildHmacFallbackBody(methodName, node);
        this.inMethod = prevInMethod;
        this.currentMethodName = prevMethodName;
        this.stringVariables = prevStringVariables;
        return method;
      }

      // Parameters carry no JS type annotation, unlike local "const x = ..."
      // declarations (see transformLetStatement's stringVariables tracking) -
      // infer string-typed parameters from how they're *used* in the body
      // (e.g. "bitString += '0'", "key.length", "text.charAt(i)") so
      // key/text/bitString-style string parameters get substr()/split()
      // treatment instead of being misdetected as arrays ("Can't use string
      // as an ARRAY ref"). Common in classical ciphers and LZ-style
      // compression codecs that pass strings between helper methods.
      if (node.value && node.value.params && node.value.body) {
        const paramNames = new Set(node.value.params.map(p =>
          (p.type === 'AssignmentPattern' ? p.left.name : p.name)).filter(Boolean));
        const inferredStrings = this._inferStringParamsFromUsage(node.value.body, paramNames);
        for (const name of inferredStrings) this.stringVariables.add(name);

        // Cross-call-site evidence (see transformClassDeclaration's
        // callSiteStringParams prescan) - catches string params whose only
        // usage in this particular method's body gives no local signal
        // (e.g. compared against an already-string array element).
        const callSiteStrings = this.callSiteStringParams.get(methodName);
        if (callSiteStrings) for (const name of callSiteStrings) this.stringVariables.add(name);
      }

      // Body - see _transformFunctionScopeBody's doc comment (SCOPED
      // registration of any nested declarations THIS method itself
      // declares, plus the "my $name;" pre-declaration hoist for forward
      // references among sibling nested functions - JS hoisting).
      if (node.value && node.value.body) {
        method.body = this._transformFunctionScopeBody(node.value.body);
      }

      this.inMethod = prevInMethod;
      this.currentMethodName = prevMethodName;
      this.stringVariables = prevStringVariables;

      return method;
    }

    /**
     * True if `node` (a MethodDefinition) is one of the HOTP/TOTP/
     * SP800-108-* "compute HMAC via Node's real crypto module, else die"
     * fallback methods - see the doc comment at the call site in
     * transformMethodDefinition. Matched structurally (method name shape +
     * param count + the giveaway error text still present somewhere in the
     * original JS body) rather than by method name alone, so an unrelated
     * method that happens to share one of these names elsewhere doesn't get
     * silently replaced.
     *
     * Two shapes exist in this codebase: hotp.js/totp.js's 2-param
     * "_hmacSHA1(key, message)"/"_hmac(key, message)" (algorithm fixed by
     * the method name, or read from a "this._hashAlgorithm" field), and
     * sp800-108-{counter,feedback,pipeline}.js's 4-param
     * "_hmacCompute(key, message, hashName, hashOutputSize)" (algorithm
     * passed as an explicit runtime argument by _hmacSHA1/256/512, which
     * are themselves just thin 2-param wrappers with no die of their own -
     * only "_hmacCompute" itself contains the fallback throw).
     * @param {string} methodName
     * @param {object} node - JS AST MethodDefinition node
     * @returns {boolean}
     */
    _isHmacFallbackMethod(methodName, node) {
      if (!/^_?hmac(sha-?(1|256|512)|compute)?$/i.test(methodName)) return false;
      const params = node.value && node.value.params;
      if (!params || (params.length !== 2 && params.length !== 4)) return false;
      const body = node.value && node.value.body;
      if (!body) return false;
      return this._nodeContainsStringMatching(body, /cannot compute hmac/i);
    }

    /**
     * Recursively search a (JS, not Perl) AST subtree for a string Literal
     * whose value matches `re`. Generic own-property walk (mirrors
     * _containsForcedDoubleMultiply's Perl-AST equivalent below) so it
     * doesn't need updating as the JS AST shape evolves.
     * @param {*} node
     * @param {RegExp} re
     * @param {Set} [seen]
     * @returns {boolean}
     */
    _nodeContainsStringMatching(node, re, seen) {
      if (!node || typeof node !== 'object') return false;
      if (node.type === 'Literal' && typeof node.value === 'string' && re.test(node.value)) return true;
      if (typeof node.value === 'string' && re.test(node.value) && node.type !== 'Identifier') return true;
      seen = seen || new Set();
      if (seen.has(node)) return false;
      seen.add(node);
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === 'loc' || key === 'range') continue;
        const val = node[key];
        if (Array.isArray(val)) {
          for (const item of val) {
            if (this._nodeContainsStringMatching(item, re, seen)) return true;
          }
        } else if (val && typeof val === 'object') {
          if (this._nodeContainsStringMatching(val, re, seen)) return true;
        }
      }
      return false;
    }

    /**
     * Synthesize a real HMAC implementation (Perl Digest::SHA) for one of
     * the fallback methods identified by _isHmacFallbackMethod - see the
     * doc comment at the transformMethodDefinition call site for why the
     * generic body transform can't be used here (there's no real body left
     * to transform). Builds "my $keyStr = pack('C*', @$key); ... return
     * [unpack('C*', $digest)];" using the JS method's own two parameter
     * names for $key/$message so it still works if a caller ever renames
     * them.
     * @param {string} methodName
     * @param {object} node - JS AST MethodDefinition node
     * @returns {PerlBlock}
     */
    _buildHmacFallbackBody(methodName, node) {
      this.addRequiredModule('Digest::SHA');
      const params = node.value.params;
      const keyParam = (params[0].type === 'AssignmentPattern' ? params[0].left.name : params[0].name) || 'key';
      const msgParam = (params[1].type === 'AssignmentPattern' ? params[1].left.name : params[1].name) || 'message';
      // sp800-108-*.js's 4-param "_hmacCompute(key, message, hashName,
      // hashOutputSize)" shape passes the algorithm as an explicit runtime
      // argument - simplest and most reliable source when present.
      const hashNameParam = params.length === 4
        ? ((params[2].type === 'AssignmentPattern' ? params[2].left.name : params[2].name) || null)
        : null;

      // Fixed-algorithm variants (_hmacSHA1/_hmacSHA256/_hmacSHA512) know
      // their digest function from the method name alone. The generic
      // "_hmac(key, message)" (totp.js) instead picks the algorithm at
      // runtime from `this._hashAlgorithm` (a "SHA-1"/"SHA-256"/"SHA-512"
      // string field) - detected structurally below rather than hardcoded,
      // in case a future file names the field differently.
      const m = /^_?hmac(sha-?(1|256|512))/i.exec(methodName);
      const fixedBits = m ? m[2].replace('-', '') : null;

      let algoSelectCode;
      if (fixedBits) {
        algoSelectCode = `my $_hmacFn = \\&Digest::SHA::hmac_sha${fixedBits};`;
      } else {
        const algoSource = hashNameParam ? `$${hashNameParam}` :
          `($self->{'${this._findHashAlgorithmFieldName(node.value.body) || '_hashAlgorithm'}'} // 'SHA-1')`;
        algoSelectCode =
          `my $_algo = uc(${algoSource});\n` +
          `    my $_hmacFn;\n` +
          `    if ($_algo eq 'SHA-1' || $_algo eq 'SHA1') { $_hmacFn = \\&Digest::SHA::hmac_sha1; }\n` +
          `    elsif ($_algo eq 'SHA-256' || $_algo eq 'SHA256') { $_hmacFn = \\&Digest::SHA::hmac_sha256; }\n` +
          `    elsif ($_algo eq 'SHA-512' || $_algo eq 'SHA512') { $_hmacFn = \\&Digest::SHA::hmac_sha512; }\n` +
          `    else { die "Unsupported hash algorithm: $_algo"; }`;
      }

      const rawCode =
        `do {\n` +
        `    ${algoSelectCode}\n` +
        `    my $_keyStr = pack('C*', map { $_ & 0xFF } (ref($${keyParam}) eq 'ARRAY' ? @{$${keyParam}} : unpack('C*', $${keyParam})));\n` +
        `    my $_msgStr = pack('C*', map { $_ & 0xFF } (ref($${msgParam}) eq 'ARRAY' ? @{$${msgParam}} : unpack('C*', $${msgParam})));\n` +
        `    my $_digest = $_hmacFn->($_msgStr, $_keyStr);\n` +
        `    return [unpack('C*', $_digest)];\n` +
        `}`;

      return new PerlBlock([new PerlExpressionStatement(new PerlRawCode(rawCode))]);
    }

    /**
     * Find the `this.<field>` whose value feeds a ".toUpperCase()" call
     * inside an HMAC fallback method's body (e.g. totp.js's "const hashAlgo
     * = this._hashAlgorithm.toUpperCase();") - see _buildHmacFallbackBody's
     * generic-algorithm-selection branch. Falls back to '_hashAlgorithm'
     * (this codebase's actual field name in every current caller) when no
     * such expression is found.
     * @param {object} body - JS AST method body
     * @returns {string|null}
     */
    _findHashAlgorithmFieldName(body) {
      const stack = [body];
      const seen = new Set();
      while (stack.length) {
        const node = stack.pop();
        if (!node || typeof node !== 'object' || seen.has(node)) continue;
        seen.add(node);
        if (node.type === 'CallExpression' && node.callee && node.callee.type === 'MemberExpression' &&
            node.callee.property && node.callee.property.name === 'toUpperCase') {
          const obj = node.callee.object;
          if (obj && obj.type === 'MemberExpression' && obj.object && obj.object.type === 'ThisExpression' &&
              obj.property && obj.property.name)
            return obj.property.name;
        }
        for (const key of Object.keys(node)) {
          if (key === 'parent' || key === 'loc' || key === 'range') continue;
          const val = node[key];
          if (Array.isArray(val)) stack.push(...val);
          else if (val && typeof val === 'object') stack.push(val);
        }
      }
      return null;
    }

    /**
     * Transform getter/setter pair into combined Perl accessor method
     * JavaScript: get foo() { return this._foo; }
     *             set foo(v) { this._foo = v; }
     * Perl:       sub foo { my $self = shift; if (@_) { <setter body> } else { <getter body> } }
     */
    transformAccessorPair(name, getterNode, setterNode) {
      const method = new PerlSub(name);

      // Don't add $self as parameter - we'll shift it manually
      // This allows the @_ check to work correctly for getter/setter detection

      const prevInMethod = this.inMethod;
      this.inMethod = true;

      const block = new PerlBlock();

      // First statement: my $self = shift; (removes $self from @_)
      block.statements.push(
        new PerlVarDeclaration('my', 'self', '$', new PerlCall('shift', []))
      );

      if (setterNode && getterNode) {
        // Both getter and setter - create if (@_) { setter } else { getter }
        const setterParam = setterNode.value?.params?.[0]?.name || 'value';

        // Setter branch: my $value = shift; <setter body>
        const setterBranch = new PerlBlock();
        setterBranch.statements.push(
          new PerlVarDeclaration('my', setterParam, '$', new PerlCall('shift', []))
        );

        // Transform setter body statements
        if (setterNode.value?.body?.body) {
          for (const stmt of setterNode.value.body.body) {
            const transformed = this.transformStatement(stmt);
            if (transformed) {
              if (Array.isArray(transformed)) {
                setterBranch.statements.push(...transformed);
              } else {
                setterBranch.statements.push(transformed);
              }
            }
          }
        }

        // Getter branch: transform getter body
        const getterBranch = new PerlBlock();
        if (getterNode.value?.body?.body) {
          for (const stmt of getterNode.value.body.body) {
            const transformed = this.transformStatement(stmt);
            if (transformed) {
              if (Array.isArray(transformed)) {
                getterBranch.statements.push(...transformed);
              } else {
                getterBranch.statements.push(transformed);
              }
            }
          }
        }

        // Create if (@_) { setter } else { getter }
        const ifStmt = new PerlIf(
          new PerlCall('scalar', [new PerlIdentifier('_', '@')]),
          setterBranch,
          [],  // no elsif branches
          getterBranch
        );
        block.statements.push(ifStmt);

      } else if (setterNode) {
        // Setter only
        const setterParam = setterNode.value?.params?.[0]?.name || 'value';

        block.statements.push(
          new PerlVarDeclaration('my', setterParam, '$', new PerlCall('shift', []))
        );

        if (setterNode.value?.body?.body) {
          for (const stmt of setterNode.value.body.body) {
            const transformed = this.transformStatement(stmt);
            if (transformed) {
              if (Array.isArray(transformed)) {
                block.statements.push(...transformed);
              } else {
                block.statements.push(transformed);
              }
            }
          }
        }

      } else if (getterNode) {
        // Getter only
        if (getterNode.value?.body?.body) {
          for (const stmt of getterNode.value.body.body) {
            const transformed = this.transformStatement(stmt);
            if (transformed) {
              if (Array.isArray(transformed)) {
                block.statements.push(...transformed);
              } else {
                block.statements.push(transformed);
              }
            }
          }
        }
      }

      method.body = block;
      this.inMethod = prevInMethod;

      return method;
    }

    /**
     * Combine a legacy object-literal's "get name() {...}"/"set name(v) {...}"
     * property pair (see the 'ObjectLiteral' case in transformExpression)
     * into a single anonymous coderef that branches on argument count at
     * call time, exactly mirroring transformAccessorPair's class-based
     * "if (@_) { setter } else { getter }" shape - except returned as a
     * PerlAnonSub (a hash value), not a named PerlSub (a class method),
     * since these objects are plain hashrefs dispatched through
     * _LegacyAlgoObj's AUTOLOAD (see PerlEmitter.js), not blessed class
     * instances with real named subs.
     * @param {object|null} getterProp - the 'get' property node ({key, value: FunctionExpression-like, kind:'get'}), or null
     * @param {object|null} setterProp - the 'set' property node ({key, value: FunctionExpression-like, kind:'set'}), or null
     * @returns {PerlAnonSub}
     */
    transformObjectAccessorPair(getterProp, setterProp) {
      const prevInMethod = this.inMethod;
      this.inMethod = true;

      // A getter/setter defined as a plain (non-arrow) object-literal method
      // has its OWN dynamic "this" (the instance the accessor is invoked on -
      // always mapped to the literal Perl identifier "$self" throughout this
      // transformer, see e.g. ThisPropertyAccess handling above). That is a
      // genuinely different binding from an outer factory-function-scoped
      // "const self = this;" closure variable of the SAME source name "self"
      // (e.g. algorithms/block/deal.js's "CreateInstance(...) { const self =
      // this; const instance = { set key(v) { self.KeySetup(v); ... } }; }" -
      // self there is deal.js's own class instance, wholly unrelated to the
      // accessor's own instance receiver). Both collapse to the identical
      // Perl variable name "$self" once transformed, so shifting the
      // accessor's own receiver into "my $self = shift();" below would
      // silently shadow (permanently hide) the outer closure's $self for the
      // rest of this sub body - every "self.Whatever(...)" call inside then
      // resolved against the WRONG object (the instance itself, which has no
      // such method) instead of the captured outer reference, and since the
      // harness's property-setter call site wraps this in an eval(), the
      // resulting "Can't locate object method" die was silently swallowed,
      // leaving the key/nonce/etc. never actually set ("Key not set" /
      // "Not initialized" downstream). Detect a bare (non-"this") JS
      // Identifier literally named "self" anywhere in the getter/setter
      // body and rename it to a non-colliding synthetic name, capturing the
      // real outer value into that name BEFORE the receiver shift below
      // (still visible at that point - a "my" declaration only masks
      // starting with the *next* statement).
      const hasFreeSelf = this._hasFreeIdentifier(getterProp?.value?.body, 'self') ||
        this._hasFreeIdentifier(setterProp?.value?.body, 'self');
      if (hasFreeSelf) {
        if (getterProp) getterProp = { ...getterProp, value: { ...getterProp.value, body: this._renameFreeIdentifier(getterProp.value.body, 'self', '_outerSelf') } };
        if (setterProp) setterProp = { ...setterProp, value: { ...setterProp.value, body: this._renameFreeIdentifier(setterProp.value.body, 'self', '_outerSelf') } };
      }

      const block = new PerlBlock();
      if (hasFreeSelf) {
        block.statements.push(
          new PerlVarDeclaration('my', '_outerSelf', '$', new PerlIdentifier('self', '$'))
        );
      }
      block.statements.push(
        new PerlVarDeclaration('my', 'self', '$', new PerlCall('shift', []))
      );

      const emitBody = (fnNode, target) => {
        const body = fnNode?.value?.body?.body || fnNode?.value?.body || [];
        for (const stmt of body) {
          const transformed = this.transformStatement(stmt);
          if (!transformed) continue;
          if (Array.isArray(transformed)) target.push(...transformed);
          else target.push(transformed);
        }
      };

      if (setterProp && getterProp) {
        const setterParam = setterProp.value?.params?.[0]?.name || 'value';
        this.registerVariableType(setterParam, '$');

        const setterBranch = new PerlBlock();
        setterBranch.statements.push(
          new PerlVarDeclaration('my', setterParam, '$', new PerlCall('shift', []))
        );
        emitBody(setterProp, setterBranch.statements);

        const getterBranch = new PerlBlock();
        emitBody(getterProp, getterBranch.statements);

        block.statements.push(new PerlIf(
          new PerlCall('scalar', [new PerlIdentifier('_', '@')]),
          setterBranch,
          [],
          getterBranch
        ));
      } else if (setterProp) {
        const setterParam = setterProp.value?.params?.[0]?.name || 'value';
        this.registerVariableType(setterParam, '$');
        block.statements.push(
          new PerlVarDeclaration('my', setterParam, '$', new PerlCall('shift', []))
        );
        emitBody(setterProp, block.statements);
      } else if (getterProp) {
        emitBody(getterProp, block.statements);
      }

      this.inMethod = prevInMethod;
      return new PerlAnonSub([], block);
    }

    /**
     * Transform a property definition
     */
    transformPropertyDefinition(node) {
      const fieldName = node.key.name;
      const field = new PerlField(fieldName);
      field.isStatic = node.static === true;

      if (node.value) {
        field.defaultValue = this.transformExpression(node.value);
      }

      return field;
    }

    transformStaticBlock(node) {
      // ES2022 static block -> Perl module-level statements
      // Perl doesn't have static class blocks, so transform to statements
      // Handle both array body and object with body property
      const statements = Array.isArray(node.body) ? node.body :
                         (node.body?.body && Array.isArray(node.body.body)) ? node.body.body : [];
      return statements.map(stmt => this.transformStatement(stmt));
    }

    /**
     * Transform a block statement
     */
    transformBlockStatement(node) {
      const block = new PerlBlock();

      if (node.body && Array.isArray(node.body)) {
        for (const stmt of node.body) {
          const perlStmt = this.transformStatement(stmt);
          if (perlStmt) {
            if (Array.isArray(perlStmt)) {
              block.statements.push(...perlStmt);
            } else {
              block.statements.push(perlStmt);
            }
          }
        }
      }

      return block;
    }

    /**
     * Transform a statement
     * CRITICAL: Handle all 16 statement types
     */
    transformStatement(node) {
      if (!node) return null;

      switch (node.type) {
        case 'VariableDeclaration':
          return this.transformLetStatement(node);

        case 'ExpressionStatement':
          return this.transformExpressionStatementNode(node);

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

        case 'TryStatement':
          return this.transformTryStatement(node);

        case 'ThrowStatement':
          return this.transformThrowStatement(node);

        case 'BlockStatement':
          return this.transformBlockStatement(node);

        case 'BreakStatement':
          return new PerlLast();

        case 'ContinueStatement':
          return new PerlNext();

        case 'LabeledStatement':
          return this.transformLabeledStatement(node);

        // A named "function foo() {...}" declared *inside* another
        // function/method body (not at module top level, which instead
        // goes through transformFunctionDeclaration) - e.g. hash/
        // haraka.js's per-column "function mulX(p) {...}" Galois-multiply
        // helper, declared and called from inside a for-loop body. This
        // case was entirely missing (fell through to the "default: return
        // null" below, silently dropping the declaration), so every call
        // site died "Undefined subroutine &main::mulX called" - the
        // helper simply never existed anywhere in the emitted Perl. See
        // _buildFunctionSub's doc comment for why emitting it in place is
        // both valid and safe even inside a loop body.
        case 'FunctionDeclaration':
          return this._buildFunctionSub(node, true);

        default:
          return null;
      }
    }

    /**
     * Transform a variable declaration to 'my' statement
     */
    transformLetStatement(node) {
      const statements = [];

      for (const decl of node.declarations) {
        const varName = decl.id.name;
        let initializer = null;

        if (decl.init) {
          // "let t = A - B - C;" (a >=2-deep chain of only "-"/"+") in a
          // BigInt-flagged file, immediately assigned to a fresh variable
          // (not itself already the operand of a "% modulus" or "& wideMask"
          // - those get exact treatment via the dedicated cases in
          // transformBinaryExpression already) - e.g. random/swb.js's
          // Subtract-with-Borrow recurrence "let t = this._state[j] -
          // this._state[k] - this._carry;", later compared "t < 0n" and
          // conditionally corrected "if (t < 0n) t += this.M;". Each operand
          // is a full 64-bit-range BigInt (0..2^64-1), so the TRUE
          // (unbounded) difference can range roughly -2^64..2^64 - a full
          // 65-66 bits, wider than even a 64-bit-wraparound-safe native
          // Perl integer. The generic '-' case just below routes BigInt-file
          // arithmetic through OpCodes::u64sub (exact only up to 64 bits
          // inside a `use integer` block, i.e. modulo 2**64) - since "use
          // integer" reinterprets a large *unsigned* operand (e.g.
          // 2^64-1) by its signed 64-bit bit-pattern (-1) before
          // subtracting, the result the code actually needs to inspect - is
          // this true (unbounded) difference negative? - silently answers a
          // *different* question (is the mod-2**64-wrapped difference's own
          // sign bit set?), which disagrees with JS's exact BigInt "t < 0n"
          // test whenever the true difference's magnitude exceeds 64 bits.
          // Detected structurally (chain of >=2 "-"/"+" operators, recursively
          // rebuilt via _buildExactBigIntExpr - the same helper the '%'/'&'
          // exact-precision cases already use) rather than widening every
          // bare "-" in a BigInt file, which would revert to the native
          // u64sub wraparound semantics several passing hash/PRNG state
          // updates rely on. Gated on the whole expression's own inferred
          // result type not being narrow, rather than each individual
          // operand: unlike the '%' case's divisor (usually a simple named
          // constant), this chain's leaves are frequently array-element
          // reads (e.g. "this._state[j]") whose *element* type the type-
          // aware parser can't see through - it falls back to a generic
          // narrow default (e.g. 'int32') for those specific leaves even in
          // a file that otherwise deals exclusively in 64-bit BigInts,
          // which would wrongly exclude exactly the case this rule targets.
          // Excludes plain string concatenation chains - e.g. asymmetric/
          // rsa.js's (BigInt-flagged for its educational n/e/d key literals)
          // unrelated "const keyId = 'RSA_' + this.keySize + '_EDUCATIONAL';"
          // has the identical structural shape (a chain of 2 "+"s) but is
          // pure string-building, not arithmetic - routing it through
          // _buildExactBigIntExpr wrapped each piece in "Math::BigInt->new(
          // 'RSA_')", which isn't a number at all, corrupting the id string
          // into "NaN" everywhere it was later used (this.keySize itself,
          // read back out through the same "+"-concatenation idiom
          // elsewhere in the file, silently propagated the corruption to
          // otherwise-unrelated encrypt/decrypt output).
          const isChainedAddSub = (n) => n && n.type === 'BinaryExpression' && (n.operator === '-' || n.operator === '+');
          if (this._fileHasBigIntLiterals && isChainedAddSub(decl.init) && isChainedAddSub(decl.init.left) &&
              !this._isNarrowResultType(decl.init.resultType) &&
              !this.isStringContext(decl.init.left, decl.init.right) &&
              !this.isStringContext(decl.init.left.left, decl.init.left.right)) {
            this.addRequiredModule('Math::BigInt');
            initializer = new PerlRawCode(`${this._buildExactBigIntExpr(decl.init)}`);
          } else if (this._fileHasBigIntLiterals && decl.init.type === 'BinaryExpression' &&
              decl.init.operator === '*' && this._wideProductVarNames && this._wideProductVarNames.has(varName)) {
            // "const product = a * b;" later split into high/low 64-bit
            // halves via a literal ">> 64"-or-wider shift on `product` - see
            // _wideProductVarNames' doc comment (GenerateFromAST) for the
            // mac/vmac.js 64x64->128 widening-multiply idiom this covers.
            // Deliberately NOT routed through the shared _buildExactBigIntExpr
            // (used by the '%'/'&'-of-'*' cases above) unchanged: `a`/`b` here
            // are frequently themselves the result of upstream
            // OpCodes::u64add/u64sub arithmetic (see PerlEmitter.js's
            // emitOpCodesRuntimeStub), which runs inside a `use integer`
            // block - Perl's "use integer" reinterprets any *unsigned* 64-bit
            // value >= 2**63 by its SIGNED 64-bit bit-pattern (i.e. negative)
            // once the true sum/difference overflows a signed 64-bit range,
            // even though the underlying bits are still the correct unsigned
            // 64-bit wraparound value. "Math::BigInt->new($negativeLookingVar)"
            // would capture that wrong (negative) magnitude instead of the
            // intended unsigned one - e.g. mac/vmac.js's L3-hash finalization
            // "const prod = p1 * p2;" (p1 fresh off "p1 += k1", which read
            // back negative here) silently multiplied the wrong operand
            // magnitude. Masking each operand with the 64-bit all-ones mask
            // first reinterprets its bit pattern as unsigned again (Perl's
            // bitwise "&" always operates on the UV/bit-pattern regardless of
            // how the value's sign prints - see perlop) - a no-op for any
            // operand that was already a small non-negative value, and the
            // needed correction for one that wrapped negative.
            this.addRequiredModule('Math::BigInt');
            const leftExpr = this.transformExpression(decl.init.left);
            const rightExpr = this.transformExpression(decl.init.right);
            initializer = new PerlRawCode(`Math::BigInt->new((${leftExpr}) & 18446744073709551615) * ((${rightExpr}) & 18446744073709551615)`);
          } else {
            initializer = this.transformExpression(decl.init);
          }

          // Track if this variable holds a code reference (function expression or arrow function)
          if (decl.init.type === 'FunctionExpression' ||
              decl.init.type === 'ArrowFunctionExpression' || decl.init.type === 'ArrowFunction') {
            this.codeRefVariables.add(varName);
          }

          // Track "const OC = OpCodes;" / "const OC = typeof OpCodes !==
          // 'undefined' ? OpCodes : global.OpCodes;"-style local aliases of
          // the OpCodes module itself - see opCodesAliasNames' doc comment.
          if (this._exprIsOpCodesReference(decl.init))
            this.opCodesAliasNames.add(varName);
          else
            this.opCodesAliasNames.delete(varName);

          // "const f = cond ? funcA : funcB;" where both branches are
          // top-level helper-function references (see
          // _collectTopLevelFunctionNames' doc comment) - e.g.
          // aead/spook.js's "const permute = shadowSize === 512 ?
          // shadow512 : shadow384;", picking between two interchangeable
          // permutation implementations per variant. Without this, a later
          // bare "permute(state)" call fell through to a plain
          // "permute(state)"/"$self->permute(...)"-style call attempt
          // instead of the needed "$permute->(state)" coderef deref,
          // dying "Undefined subroutine ...::permute called".
          if (decl.init.type === 'ConditionalExpression' &&
              decl.init.consequent?.type === 'Identifier' && decl.init.alternate?.type === 'Identifier' &&
              this._topLevelFunctionNames?.has(decl.init.consequent.name) &&
              this._topLevelFunctionNames?.has(decl.init.alternate.name)) {
            this.codeRefVariables.add(varName);
          }

          // Same, but for "const f = this.someMethod();" where someMethod()
          // always structurally returns a function - see
          // classFunctionReturningMethods' doc comment in
          // transformClassDeclaration.
          if (decl.init.type === 'ThisMethodCall' && decl.init.method && this.currentClassName) {
            const flagged = this.classFunctionReturningMethods.get(this.currentClassName);
            if (flagged && flagged.has(decl.init.method))
              this.codeRefVariables.add(varName);
          }

          // "const gammaTau = this.algorithm.tables.gammaTau;" - a local
          // alias of a plain-data-hashref coderef property (see
          // objectCoderefPropNames' doc comment). Later calls of the bare
          // local name ("gammaTau(b1, 0, 1, 0)") must deref-call the coderef
          // ($gammaTau->(...)), not a bareword sub call (main::gammaTau(...),
          // which happened to exist here - the top-level function of the
          // same name - but wouldn't in general, and is the wrong
          // dispatch target if a class ever shadowed/rebound the property).
          if (decl.init.type === 'MemberExpression' && !decl.init.computed) {
            const propName = decl.init.property?.name || decl.init.property?.value;
            if (propName && this.objectCoderefPropNames && this.objectCoderefPropNames.has(propName))
              this.codeRefVariables.add(varName);
          }

          // Track if this variable holds a string value (structurally, e.g.
          // string method chains like .toUpperCase().replace(...)) so later
          // Identifier references (isStringType) recognize it too - needed
          // for e.g. "for (const c of normalizedInput)" and str[i] indexing.
          if (this.isStringType(decl.init))
            this.stringVariables.add(varName);
          else
            this.stringVariables.delete(varName);

          // Track if this variable was assigned from a call to a method
          // known (from the class pre-scan) to return an object literal
          // with a "length" field - e.g. "const match = this._findLongestMatch(pos);"
          // so "match.length" resolves to the hash key, not ArrayLength.
          // Also covers a variable declared *directly* from such an object
          // literal in the first place - e.g. "let bestMatch = { distance: 0,
          // length: 0 };" (built up in place across a loop, then read/
          // returned as "bestMatch.length"/"return bestMatch;" - see
          // _findLongestMatch-style LZ77 matchers and the
          // _collectLengthFieldVarNames pre-scan this mirrors).
          const initIsLengthFieldObject = (decl.init.type === 'ObjectExpression' || decl.init.type === 'ObjectLiteral') &&
            (decl.init.properties || []).some(p => {
              const key = p.key;
              return (typeof key === 'string' ? key : (key?.name || key?.value)) === 'length';
            });
          if (initIsLengthFieldObject) {
            this.objectLengthVariables.add(varName);
          } else if (decl.init.type === 'ThisMethodCall' && this.currentClassName) {
            const flagged = this.classLengthFieldMethods.get(this.currentClassName);
            if (flagged && flagged.has(decl.init.method))
              this.objectLengthVariables.add(varName);
            else
              this.objectLengthVariables.delete(varName);
          } else if (decl.init.type === 'CallExpression' && decl.init.callee?.type === 'MemberExpression' && !decl.init.callee.computed) {
            // Same as the ThisMethodCall branch above, but for a call on some
            // *other* object - e.g. "const match = hashTable.find(...);" -
            // see anyClassLengthFieldMethodNames' doc comment.
            const calledMethod = decl.init.callee.property?.name || decl.init.callee.property?.value;
            if (calledMethod && this.anyClassLengthFieldMethodNames && this.anyClassLengthFieldMethodNames.has(calledMethod))
              this.objectLengthVariables.add(varName);
            else
              this.objectLengthVariables.delete(varName);
          } else {
            this.objectLengthVariables.delete(varName);
          }
        }

        const sigil = this.inferSigilFromValue(decl.init);
        const varDecl = new PerlVarDeclaration('my', varName, sigil, initializer);

        this.registerVariableType(varName, sigil);
        statements.push(varDecl);
      }

      return statements;
    }

    /**
     * Transform an expression statement
     */
    transformExpressionStatementNode(node) {
      // Check if expression is ArrayForEach - it returns a statement, not expression
      const exprType = node.expression.type || node.expression.ilNodeType;
      if (exprType === 'ArrayForEach') {
        return this.transformArrayForEach(node.expression);
      }

      // ArrayFill as statement: array.fill(value) mutates in place
      // Generate: @{$arr} = (value) x scalar(@{$arr});
      if (exprType === 'ArrayFill') {
        const fillArr = this.transformExpression(node.expression.array);
        const fillVal = this.transformExpression(node.expression.value);
        const deref = this.wrapArrayDeref(fillArr);
        const fillLen = new PerlCall('scalar', [deref]);
        return new PerlExpressionStatement(
          new PerlAssignment(
            new PerlUnaryExpression('@', fillArr, true),
            '=',
            new PerlBinaryExpression(new PerlGrouped(fillVal), 'x', fillLen)
          )
        );
      }

      // ArraySort as statement: array.sort(fn) mutates in place
      // Generate: @{$arr} = sort { ... } @{$arr};
      if (exprType === 'ArraySort') {
        const sortArr = this.transformExpression(node.expression.array);
        const deref = this.wrapArrayDeref(sortArr);
        const compareFn = node.expression.compareFn;
        if (compareFn && compareFn.params && compareFn.params.length >= 2) {
          const aName = compareFn.params[0].name || 'a';
          const bName = compareFn.params[1].name || 'b';
          this.registerVariableType(aName, '$');
          this.registerVariableType(bName, '$');
          const bodyStmts = compareFn.body.type === 'BlockStatement'
            ? compareFn.body.body.map(s => this.transformStatement(s)).filter(s => s !== null)
            : [new PerlExpressionStatement(this.transformExpression(compareFn.body))];
          return new PerlExpressionStatement(
            new PerlAssignment(
              new PerlUnaryExpression('@', sortArr, true),
              '=',
              new PerlCall('sort', [new PerlAnonSub(
                [new PerlParameter(aName, '$'), new PerlParameter(bName, '$')],
                new PerlBlock(bodyStmts)), deref])
            )
          );
        }
        // No compareFn - simple sort
        return new PerlExpressionStatement(
          new PerlAssignment(
            new PerlUnaryExpression('@', sortArr, true),
            '=',
            new PerlCall('sort', [deref])
          )
        );
      }

      // Handle ClassName = class extends X { ... } assignment
      // Convert to a proper ClassDeclaration so the class body is processed
      if (node.expression.type === 'AssignmentExpression' &&
          node.expression.operator === '=' &&
          node.expression.right &&
          node.expression.right.type === 'ClassExpression') {
        const classNode = node.expression.right;
        // Synthesize a ClassDeclaration from the ClassExpression + assignment target
        const className = node.expression.left.name || node.expression.left.value;
        if (className) {
          const syntheticDecl = {
            ...classNode,
            type: 'ClassDeclaration',
            id: { name: className, type: 'Identifier' }
          };
          // transformClassDeclaration pushes directly to currentModule.statements
          this.transformClassDeclaration(syntheticDecl);
          return null; // Suppress the expression statement
        }
      }

      const expr = this.transformExpression(node.expression);
      if (!expr) return null;

      return new PerlExpressionStatement(expr);
    }

    /**
     * Transform a return statement
     */
    transformReturnStatement(node) {
      if (node.argument) {
        const expr = this.transformExpression(node.argument);
        return new PerlReturn(expr);
      }

      return new PerlReturn();
    }

    /**
     * A guard-collapsed if-statement (see transformIfStatement's
     * _isFrameworkGuard/_isFalseGuard branches) emits ONLY its surviving
     * body, with no "if"/"eval"/other keyword in front of the braces to
     * disambiguate them the way Perl needs. A completely empty "{ }" used
     * as a bare statement is themselves ambiguous with an empty hashref
     * constructor, and Perl only special-cases that as a block when nothing
     * else follows it on the same statement - immediately followed by
     * another brace-opening statement (another bare block, an eval, a sub,
     * ...) it fails to compile (verified: `{ }\n eval { };` is a syntax
     * error, `{ 1; }\n eval { };` is not). Guarantee at least one statement
     * inside so the braces are never empty.
     * @private
     */
    _nonEmptyBareBlock(body) {
      if (body && body.nodeType === 'Block' && (!body.statements || body.statements.length === 0))
        body = null;
      return body || new PerlBlock([new PerlExpressionStatement(PerlLiteral.Number(1))]);
    }

    /**
     * Transform an if statement
     */
    transformIfStatement(node) {
      // "if (typeof X !== 'bigint') X = BigInt(X);" - see
      // _matchNormalizeToBigIntGuard's doc comment for why this needs to
      // be special-cased ahead of the generic typeof/BigInt(...) handling.
      const normalizeBigIntVar = this._matchNormalizeToBigIntGuard(node);
      if (normalizeBigIntVar) {
        this.addRequiredModule('Math::BigInt');
        const varRef = '$' + normalizeBigIntVar;
        return new PerlExpressionStatement(new PerlRawCode(
          `${varRef} = Math::BigInt->new("${varRef}") unless ref(${varRef})`
        ));
      }

      // Collapse framework-guarding if-statements: always emit the body
      // Patterns: if (typeof AlgorithmFramework !== 'undefined' && AlgorithmFramework.Find) { ... }
      //           if (typeof OpCodes !== 'undefined') { ... }
      if (this._isFrameworkGuard(node.test)) {
        const body = this.transformStatement(node.consequent);
        return this._nonEmptyBareBlock(body);
      }

      // Collapse guards against browser/JS-only globals (crypto, window, ...)
      // that never exist in transpiled Perl: always take the else branch
      // (or emit nothing if there isn't one) instead of referencing an
      // undeclared symbol inside the always-dead consequent.
      if (this._isFalseGuard(node.test)) {
        const body = node.alternate ? this.transformStatement(node.alternate) : null;
        return this._nonEmptyBareBlock(body);
      }

      const condition = this.transformExpression(node.test);
      const thenBranch = this.transformStatement(node.consequent) || new PerlBlock();

      const elsifBranches = [];
      let elseBranch = null;

      // Handle else-if chains
      if (node.alternate) {
        if (node.alternate.type === 'IfStatement') {
          // elsif
          const altCond = this.transformExpression(node.alternate.test);
          let altBody = this.transformStatement(node.alternate.consequent) || new PerlBlock();
          // A braceless "else if (cond) singleStatement;" consequent (e.g.
          // hash/hamsi.js's "_initialize()": "if (variant === 224) iv =
          // IV224; else if (variant === 256) iv = IV256; else if
          // (variant === 384) iv = IV384; else iv = IV512;" - every branch
          // a single statement, no braces) transforms to a bare statement
          // node here, not a PerlBlock - unlike thenBlock/elseBlock just
          // below, which both wrap a non-Block body via wrapInBlock(),
          // this elsif body was pushed unwrapped. PerlEmitter's emitIf
          // renders an elsif body with emitBlockContents(elsif.body), which
          // only reads a Block's .statements array - a bare statement node
          // has no such property, so the whole branch silently rendered as
          // an EMPTY "elsif (...) { }", dropping "iv = IV256;" entirely
          // (Hamsi-256 then compressed with an undef IV, corrupting every
          // hash it produced from the very first block).
          if (altBody.nodeType !== 'Block') altBody = this.wrapInBlock(altBody);
          elsifBranches.push({ condition: altCond, body: altBody });

          // Check for more elsif/else
          if (node.alternate.alternate) {
            elseBranch = this.transformStatement(node.alternate.alternate) || new PerlBlock();
          }
        } else {
          elseBranch = this.transformStatement(node.alternate) || new PerlBlock();
        }
      }

      const thenBlock = thenBranch.nodeType === 'Block' ? thenBranch : this.wrapInBlock(thenBranch);
      const elseBlock = elseBranch ? (elseBranch.nodeType === 'Block' ? elseBranch : this.wrapInBlock(elseBranch)) : null;

      return new PerlIf(condition, thenBlock, elsifBranches, elseBlock);
    }

    /**
     * Transform a for statement
     */
    transformForStatement(node) {
      // JavaScript `var` is function-scoped, unlike `let`/`const` which are
      // block-scoped. A Perl C-style `for (my $i = 0; ...; ...) { ... }`
      // scopes $i to the loop only (matching `let`), so code that reads the
      // loop variable after the loop ends (a `var` idiom) would otherwise
      // fail with "Global symbol requires explicit package name". Hoist the
      // declaration above the loop and turn the init clause into a plain
      // (non-`my`) assignment so the variable survives past the loop, same
      // as JavaScript `var`.
      let hoisted = null;
      let init;
      if (node.init && node.init.type === 'VariableDeclaration' && node.init.kind === 'var') {
        hoisted = [];
        const assignments = [];
        for (const decl of node.init.declarations) {
          const varName = decl.id.name;
          const sigil = this.inferSigilFromValue(decl.init);
          this.registerVariableType(varName, sigil);
          hoisted.push(new PerlVarDeclaration('my', varName, sigil, null));
          if (decl.init) {
            assignments.push(new PerlAssignment(
              new PerlIdentifier(varName, sigil), '=', this.transformExpression(decl.init)
            ));
          }
        }
        if (assignments.length === 0) {
          init = null;
        } else if (assignments.length === 1) {
          init = new PerlExpressionStatement(assignments[0]);
        } else {
          // Multiple `var` declarators in one init clause: ($a, $b) = (1, 2)
          init = new PerlExpressionStatement(new PerlAssignment(
            new PerlRawCode('(' + assignments.map(a => a.target).join(', ') + ')'),
            '=',
            new PerlRawCode('(' + assignments.map(a => a.value).join(', ') + ')')
          ));
        }
      } else if (node.init && node.init.type !== 'VariableDeclaration') {
        // The parser's parseForStatement() calls parseExpression() (not
        // parseStatement()) for a non-declaration init clause, so node.init
        // here is a bare expression node (AssignmentExpression,
        // SequenceExpression, UpdateExpression, ...), never wrapped in an
        // ExpressionStatement. transformStatement()'s switch only matches
        // statement node types, so passing a bare expression through it hit
        // the `default: return null` and silently dropped the initializer -
        // e.g. "for (i = 0; i < N - M; ++i)" where `i` was declared once
        // ("let i;") and reused across several successive for-loops (a
        // common idiom in twist/permutation-style code, such as MT19937's
        // _twist()), emitted as "for (; $i < ...; ++$i)" with $i forever
        // undef, since the assignment that seeded it no longer existed.
        init = new PerlExpressionStatement(this.transformExpression(node.init));
      } else {
        init = node.init ? this.transformStatement(node.init) : null;
      }

      // node.body isn't always a BlockStatement - JS permits a single
      // braceless statement as a for-loop body (e.g. "for (...) this.state[i]
      // = [0, 0];"). transformStatement() on that yields a bare statement
      // node, not a PerlBlock, and emitFor's emitBlockContents(node.body)
      // only reads node.body.statements - so an unwrapped single-statement
      // body was silently rendered as an *empty* loop body (see the matching
      // wrapInBlock() calls in transformIfStatement/While/DoWhile/ForOf a few
      // lines below, which this C-style for loop was missing).
      //
      // Push this loop's statically-estimated max-iteration bound (see
      // _estimateForLoopBound's doc comment) before transforming the body,
      // so a self-referential shift-accumulate assignment inside it (the
      // case in transformAssignmentExpression) can tell a hot, fixed-width,
      // always-safe byte-accumulate loop (e.g. SHA-512's message-schedule
      // word packing, exactly 8 iterations) apart from a genuinely
      // wide/unbounded one (e.g. Poly1305's per-block bytesToNum).
      this._loopBoundStack.push(this._estimateForLoopBound(node.test));
      const forBody = this.transformStatement(node.body);
      this._loopBoundStack.pop();
      const forBodyBlock = !forBody ? new PerlBlock()
        : (forBody.nodeType === 'Block' ? forBody : this.wrapInBlock(forBody));
      const forLoop = new PerlFor(null, null, forBodyBlock);
      forLoop.isCStyle = true;
      forLoop.init = init;
      forLoop.condition = node.test ? this.transformExpression(node.test) : null;
      forLoop.increment = node.update ? this.transformExpression(node.update) : null;

      return hoisted ? [...hoisted, forLoop] : forLoop;
    }

    /**
     * Transform a for-of statement: for (const x of array) { ... }
     * Also handles destructuring: for (const [a, b] of array) { ... }
     *
     * The parser may have already expanded destructuring into multiple declarations:
     * - First declaration with ilNodeType: 'DestructureTemp' (the temp variable)
     * - Remaining declarations with ilNodeType: 'DestructuredElement' (extracted vars)
     */
    transformForOfStatement(node) {
      // Extract variable name from left side
      let varName = 'item';
      let destructureNames = null;
      if (node.left.type === 'VariableDeclaration') {
        const declarations = node.left.declarations || [];
        const firstDecl = declarations[0];

        // Check if parser has already expanded destructuring (ilNodeType markers)
        if (firstDecl && firstDecl.ilNodeType === 'DestructureTemp') {
          // Parser has expanded destructuring - extract the temp name and element names
          varName = firstDecl.id?.name || '_destructure_' + this.destructureCounter++;
          destructureNames = [];
          for (let i = 1; i < declarations.length; ++i) {
            const decl = declarations[i];
            if (decl.ilNodeType === 'DestructuredElement' && decl.id?.name) {
              destructureNames.push(decl.id.name);
            }
          }
        } else if (firstDecl && firstDecl.id) {
          // Original ArrayPattern/ObjectPattern (if parser didn't expand)
          if (firstDecl.id.type === 'ArrayPattern' && firstDecl.id.elements) {
            destructureNames = firstDecl.id.elements.map(el => el && el.name).filter(n => n);
            varName = '_destructure_' + this.destructureCounter++;
          } else if (firstDecl.id.type === 'ObjectPattern' && firstDecl.id.properties) {
            destructureNames = firstDecl.id.properties.map(p => p.key?.name || p.value?.name).filter(n => n);
            varName = '_destructure_' + this.destructureCounter++;
          } else {
            varName = firstDecl.id.name || 'item';
          }
        }
      } else if (node.left.type === 'Identifier') {
        varName = node.left.name;
      }

      // "for (const [key, value] of someMap)" - the default Map iteration
      // protocol (no ".entries()" needed in JS - iterating a Map directly
      // already yields [key, value] pairs), over a field/variable already
      // known to be Map-backed (see _classifyMapSetContainer - the same
      // hashref-backed-Map representation mapVarNames/mapFieldNames use
      // elsewhere). E.g. compression/dna-compression.js's "for (const [key,
      // info] of this.kmerTable)". The generic array-destructuring path
      // below (indexing "$_destructure_N->[0]"/"[1]") assumes the iterable
      // is a real array of [k,v] pairs, which a Map never is here (it's a
      // plain hashref whose iteration is over its OWN keys) - reaching it
      // instead fell through to isArrayContext's default "not an array,
      // not a string either" fallback, blowing up with "Can't use string
      // ("HASH(0x...)") as an ARRAY ref" once the (wrongly split-into-
      // characters) hashref stringification was indexed.
      // "for (const [k, v] of someMap.entries())" is equivalent to iterating
      // someMap directly (explicit ".entries()" is just the spelled-out form
      // of the same default Map iteration protocol) - unwrap a no-arg
      // ".entries()" call down to its receiver first, so a Map tracked as
      // mapVarNames/mapFieldNames is still recognized here (and the
      // hash-backed mapExpr below refers to the actual Map, not a call to an
      // "entries" method the hashref was never blessed to respond to - see
      // algorithms/ecc/surface-code.js's "for (const [qubit, count] of
      // qubitCounts.entries())", which otherwise fell through to a generic
      // method-call transform and died "Can't call method entries on
      // unblessed reference").
      const mapEntriesReceiver = (node.right?.type === 'CallExpression' &&
          node.right.callee?.type === 'MemberExpression' && !node.right.callee.computed &&
          (node.right.callee.property?.name || node.right.callee.property?.value) === 'entries' &&
          (!node.right.arguments || node.right.arguments.length === 0))
        ? node.right.callee.object
        : node.right;
      if (destructureNames && destructureNames.length === 2 && this._classifyMapSetContainer(mapEntriesReceiver).isMap) {
        const mapExpr = this.transformExpression(mapEntriesReceiver);
        const keyVarName = destructureNames[0];
        const valueVarName = destructureNames[1];
        let mapBody = this.transformStatement(node.body) || new PerlBlock();
        let mapBodyBlock = mapBody.nodeType === 'Block' ? mapBody : this.wrapInBlock(mapBody);
        const valueExtractStmt = new PerlVarDeclaration('my', valueVarName, '$',
          new PerlSubscript(mapExpr, new PerlIdentifier(keyVarName, '$'), 'hash', true));
        mapBodyBlock = new PerlBlock([valueExtractStmt, ...mapBodyBlock.statements]);
        return new PerlFor('$' + keyVarName, new PerlCall('keys', [new PerlUnaryExpression('%', mapExpr, true)]), mapBodyBlock);
      }

      // Transform the iterable
      let iterable = this.transformExpression(node.right);

      // for (const char of someString) iterates code points/chars in JS,
      // not array elements - a plain scalar string has no @{...} array
      // deref form in Perl (would blow up with "Not an ARRAY reference" /
      // "Can't use string as an ARRAY ref"), so split it into characters.
      if (this.isStringType(node.right))
        iterable = new PerlCall('split', [PerlLiteral.String('', "//"), iterable]);

      // "for (const token of tokens)" where "tokens" is known (from the
      // whole-file lengthFieldArrayVarNames pre-scan) to only ever be pushed
      // {..., length: ...}-shaped object literals - flag the per-iteration
      // loop variable itself as a length-field object for the duration of
      // the body transform, so "token.length" inside the loop resolves to
      // the hash key instead of the built-in ArrayLength. See
      // _collectLengthFieldArrayVarNames's doc comment.
      const flagLoopVarAsLengthField = node.right.type === 'Identifier' &&
        this.lengthFieldArrayVarNames && this.lengthFieldArrayVarNames.has(node.right.name) &&
        !this.objectLengthVariables.has(varName);
      if (flagLoopVarAsLengthField) this.objectLengthVariables.add(varName);

      // "for (const word of words)" where "words" is itself an array of
      // strings built directly from a "words = someString.split(...)" call
      // (see stringSplitVarNames' doc comment for why this is a direct
      // structural check via the whole-file _collectStringSplitVarNames
      // prescan, rather than trusting the shared IL parser's own
      // per-reference resultType tag) - flag the per-iteration loop
      // variable itself as a string for the body transform, so "word[i]"/
      // "word.length" inside the loop resolve to substr()/length() instead
      // of the array-element defaults (which died "Can't use string ... as
      // an ARRAY ref" the moment a one-character word was indexed - see
      // encoding/morse.js's per-letter Morse-table lookup). Mirrors
      // flagLoopVarAsLengthField just above; restored after the body so it
      // doesn't leak into sibling statements the way this.stringVariables
      // normally would (see transformMethodDefinition's own stringVariables
      // snapshot/restore for the identical cross-scope leak concern).
      const loopVarWasAlreadyString = this.stringVariables.has(varName);
      const flagLoopVarAsString = !loopVarWasAlreadyString && node.right.type === 'Identifier' &&
        this.stringSplitVarNames.has(node.right.name);
      if (flagLoopVarAsString) this.stringVariables.add(varName);

      // Transform the body
      let body = this.transformStatement(node.body) || new PerlBlock();
      let bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      if (flagLoopVarAsLengthField) this.objectLengthVariables.delete(varName);
      if (flagLoopVarAsString) this.stringVariables.delete(varName);

      // If we have destructuring, add extraction statements at the beginning of the loop body
      if (destructureNames && destructureNames.length > 0) {
        const extractStatements = [];
        for (let i = 0; i < destructureNames.length; ++i) {
          const name = destructureNames[i];
          // my $name = $_destructure_X->[$i];
          extractStatements.push(new PerlVarDeclaration(
            'my',
            name,
            '$',
            new PerlSubscript(
              new PerlIdentifier(varName, '$'),
              PerlLiteral.Number(i),
              'array'
            )
          ));
        }
        // Prepend extraction statements to body
        const newStatements = [...extractStatements, ...bodyBlock.statements];
        bodyBlock = new PerlBlock(newStatements);
      }

      return new PerlFor('$' + varName, iterable, bodyBlock);
    }

    /**
     * Transform a for-in statement: for (const key in object) { ... }
     */
    transformForInStatement(node) {
      // Extract variable name from left side
      let varName = 'key';
      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        if (decl && decl.id) {
          varName = decl.id.name;
        }
      } else if (node.left.type === 'Identifier') {
        varName = node.left.name;
      }

      // Transform the object - for-in iterates over keys
      const object = this.transformExpression(node.right);
      // In Perl: foreach my $key (keys %hash) - object is usually a hashref
      // scalar ($self->{'foo'}), so it must be dereferenced into hash context.
      const keysCall = new PerlCall(new PerlIdentifier('keys'), [this.wrapHashDeref(object)]);

      const body = this.transformStatement(node.body) || new PerlBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new PerlFor('$' + varName, keysCall, bodyBlock);
    }

    /**
     * Transform a while statement
     */
    transformWhileStatement(node) {
      const condition = this.transformExpression(node.test);
      const body = this.transformStatement(node.body) || new PerlBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new PerlWhile(condition, bodyBlock);
    }

    /**
     * Transform a do-while statement
     */
    transformDoWhileStatement(node) {
      const body = this.transformStatement(node.body) || new PerlBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);
      const condition = this.transformExpression(node.test);

      const doWhile = new PerlWhile(condition, bodyBlock);
      doWhile.isDoWhile = true;
      return doWhile;
    }

    /**
     * Transform a switch statement into a "matched flag" chain of independent
     * `if` blocks inside a single labeled bare Perl block - NOT an if/elsif
     * chain (that was this method's previous implementation, and the bug it
     * had: elsif branches are mutually exclusive, so it silently discarded
     * JS's switch *fall-through* - a case with no trailing `break` is
     * supposed to keep executing into the next case's body).
     *
     * That's not just a theoretical gap: block/twofish.js's own key
     * schedule ("switch (this.k64Cnt & 3) { case 0: ...; [fall through]
     * case 3: ...; [fall through] case 2: ...; break; }", building
     * up b0..b3 across cases 0 and 3 before case 2 finally writes them into
     * gSBox) relies on exactly this - the old elsif-chain translation ran
     * ONLY the one matching case's own body, so gSBox was silently never
     * populated at all for a 192- or 256-bit key (only the 128-bit/case-2-
     * only path happened to still work). The same shape recurs in any
     * other table-driven key schedule/round function using this "group of
     * fall-through cases sharing a tail" idiom.
     *
     * The fix: a single flag ($sw_matched_N) that, once set true by a
     * matching case's own test, is never cleared again by ORing in later
     * cases' tests - so every case from the first match onward runs its
     * body, in source order, exactly like real fall-through. A `break`
     * (translated to `last SWITCH_N;`, exiting the whole labeled block in
     * one jump, wherever it's nested within the case) is the only thing
     * that stops the chain, matching JS's break-exits-the-switch semantics
     * precisely - no flag-reset bookkeeping needed. `default` just forces
     * the flag true unconditionally at its own source position: reaching
     * that position at all already proves no earlier case both matched and
     * broke (a match-with-break would have jumped out via `last` already),
     * so it's exactly "no case has matched yet" whenever control actually
     * reaches it, honoring "default" appearing anywhere, not just last.
     */
    transformSwitchStatement(node) {
      const switchId = (this._switchCounter = (this._switchCounter || 0) + 1);
      const tempVarName = '_sw_' + switchId;
      const matchedVarName = '_swm_' + switchId;
      const switchLabel = 'SWITCH' + switchId;

      // Transform the discriminant expression
      const discriminant = this.transformExpression(node.discriminant);

      // my $_sw_1 = $discriminant;
      const tempDecl = new PerlVarDeclaration('my', tempVarName, '$', discriminant);
      // my $_swm_1 = 0;
      const matchedDecl = new PerlVarDeclaration('my', matchedVarName, '$', PerlLiteral.Number(0));

      const blockStatements = [tempDecl, matchedDecl];

      for (const caseNode of node.cases) {
        const matchedRef = () => new PerlIdentifier(matchedVarName, '$');

        if (caseNode.test) {
          // $_swm_1 ||= ($_sw_1 == <test>) - or "eq" when either side is
          // string-typed (e.g. "switch (this._gateType) { case 'X': ...
          // case 'Z': ... }" - see ecc/gkp-code.js's quantum-gate-type
          // dispatch). Unconditionally using numeric "==" silently
          // miscompared every string-valued switch: Perl coerces a
          // non-numeric string operand to 0 in numeric context, so
          // "$_sw_1 == 'X'" really tested "(0-or-whatever-$_sw_1-coerces-
          // to) == 0" - true whenever the discriminant ALSO happened to be
          // a non-numeric string (matching the wrong case, or every case
          // whose test starts the scan, depending on evaluation order),
          // rather than ever comparing the actual letters.
          const tempVarRef = new PerlIdentifier(tempVarName, '$');
          const pattern = this.transformExpression(caseNode.test);
          const cmpOp = this.isStringContext(node.discriminant, caseNode.test) ? 'eq' : '==';
          const cmp = new PerlGrouped(new PerlBinaryExpression(tempVarRef, cmpOp, pattern));
          blockStatements.push(new PerlExpressionStatement(
            new PerlAssignment(matchedRef(), '||=', cmp)
          ));
        } else {
          // default: - reaching this statement at all already means no
          // earlier case both matched and broke (see doc comment above).
          blockStatements.push(new PerlExpressionStatement(
            new PerlAssignment(matchedRef(), '=', PerlLiteral.Number(1))
          ));
        }

        // Transform case body, rewriting any BreakStatement that is a
        // DIRECT (not nested-in-a-further-loop) part of this case into a
        // labeled "last SWITCH_N;" - a nested break (inside a for/while
        // within the case) already becomes a bare/unlabeled last via the
        // generic BreakStatement handling below, which correctly binds to
        // that inner loop instead (Perl resolves unlabeled last/next to
        // the nearest enclosing loop-like construct), unaffected by this
        // switch's own label.
        const caseBody = new PerlBlock();
        for (const stmt of caseNode.consequent) {
          const perlStmt = stmt.type === 'BreakStatement'
            ? new PerlLast(switchLabel)
            : this.transformStatement(stmt);
          if (perlStmt) {
            if (Array.isArray(perlStmt)) caseBody.statements.push(...perlStmt);
            else caseBody.statements.push(perlStmt);
          }
        }

        if (caseBody.statements.length > 0) {
          blockStatements.push(new PerlIf(matchedRef(), caseBody));
        }
      }

      const switchBlock = new PerlBlock(blockStatements);
      switchBlock.label = switchLabel;
      return switchBlock;
    }

    /**
     * Transform a try-catch statement
     */
    transformTryStatement(node) {
      const tryStmt = new PerlTry();
      tryStmt.useModernTry = this.options.useExperimentalFeatures;
      tryStmt.tryBlock = this.transformStatement(node.block);

      if (node.handler) {
        tryStmt.catchBlock = this.transformStatement(node.handler.body);
        if (node.handler.param) {
          tryStmt.catchVariable = '$' + node.handler.param.name;
        }
      }

      if (node.finalizer) {
        tryStmt.finallyBlock = this.transformStatement(node.finalizer);
      }

      return tryStmt;
    }

    /**
     * Transform a throw statement
     */
    transformThrowStatement(node) {
      const expr = node.argument ? this.transformExpression(node.argument) : PerlLiteral.String("error");
      return new PerlDie(expr);
    }

    /**
     * Transform a labeled statement
     */
    transformLabeledStatement(node) {
      // Transform the body statement
      const bodyStmt = this.transformStatement(node.body);

      // Add label comment
      const comment = new PerlComment(`Label: ${node.label.name}`);
      return [comment, bodyStmt];
    }

    /**
     * Wrap a statement in a block
     */
    wrapInBlock(stmt) {
      const block = new PerlBlock();
      if (stmt) {
        if (Array.isArray(stmt)) {
          block.statements.push(...stmt);
        } else {
          block.statements.push(stmt);
        }
      }
      return block;
    }

    /**
     * Transform an expression
     * CRITICAL: Handle all 19 expression types
     */
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

        case 'AssignmentExpression':
          return this.transformAssignmentExpression(node);

        case 'UpdateExpression':
          return this.transformUpdateExpression(node);

        case 'MemberExpression':
          return this.transformMemberExpression(node);

        case 'CallExpression':
          return this.transformCallExpression(node);

        case 'ArrayExpression':
          return this.transformArrayExpression(node);

        case 'ObjectExpression':
          return this.transformObjectExpression(node);

        case 'NewExpression':
          return this.transformNewExpression(node);

        case 'ThisExpression':
          return new PerlIdentifier('self', '$');

        case 'ConditionalExpression':
          return this.transformConditionalExpression(node);

        case 'ArrowFunctionExpression':
        case 'ArrowFunction':
        case 'FunctionExpression':
          return this.transformFunctionExpression(node);

        case 'SequenceExpression':
          // Transform all expressions in the sequence and join with comma
          // JavaScript: (a++, b += 2) -> Perl: ($a++, $b += 2)
          // This is important for for loop updates like: for (...; ...; r++, k += 16)
          const seqExprs = node.expressions.map(e => this.transformExpression(e));
          return new PerlList(seqExprs);

        case 'SpreadElement':
          return this.transformSpreadElement(node);

        case 'Super':
          return new PerlIdentifier('SUPER');

        case 'TemplateLiteral':
          return this.transformTemplateLiteral(node);

        case 'ObjectPattern':
          // Object destructuring - Perl doesn't support this directly
          // Return a comment placeholder
          return new PerlIdentifier('# Object destructuring not supported in Perl');

        // ========================[ IL AST Node Types ]========================
        // These are generated by the type-aware-transpiler's IL building phase

        case 'StringToBytes':
          // OpCodes.AnsiToBytes("...") -> pack/unpack or array of char codes
          return this.transformStringToBytes(node);

        case 'BytesToString':
          // OpCodes.BytesToAnsi(arr) -> pack('C*', @{$arr})
          return this.transformBytesToString(node);

        case 'HexDecode':
          // OpCodes.Hex8ToBytes("...") -> pack('H*', ...) or byte array
          return this.transformHexDecode(node);

        case 'PackBytes':
          // OpCodes.Pack32BE/LE etc -> pack(format, ...)
          return this.transformPackBytes(node);

        case 'UnpackBytes':
          // OpCodes.Unpack32BE/LE etc -> unpack(format, ...)
          return this.transformUnpackBytes(node);

        case 'ArrayXor':
          // OpCodes.XorArrays -> XOR two arrays element-wise
          return this.transformArrayXor(node);

        case 'ArrayClear':
          // OpCodes.ClearArray -> reset array
          return this.transformArrayClear(node);

        case 'ArrayForEach':
          // array.forEach callback -> foreach loop
          return this.transformArrayForEach(node);

        case 'ArrayMap':
          // array.map callback -> map loop
          return this.transformArrayMap(node);

        case 'ArrayFilter':
          // array.filter callback -> grep
          return this.transformArrayFilter(node);

        case 'RotateLeft':
        case 'RotateRight':
          // Bit rotation operations
          return this.transformRotation(node);

        // ========================[ This/Super IL Node Types ]========================

        case 'ThisPropertyAccess':
          // Properties backed by a JS get/set accessor pair (key, iv,
          // nonce, ...) must be read through the accessor method - the
          // combined Perl sub decides get-vs-set based on whether it was
          // called with arguments (see transformAccessorPair), so a
          // no-arg call here is the getter form: this.key -> $self->key()
          if (this._isAccessorProperty(node.property)) {
            return new PerlMemberAccess(
              new PerlIdentifier('self', '$'),
              new PerlCall(new PerlIdentifier(node.property), []),
              '->'
            );
          }
          // Bare (non-called) reference to one of this class's OWN methods,
          // e.g. hash/haval.js's "this.transformers = [this._deltaTransform,
          // this._moveToFrontTransform];"/"const fpFunctions = [this.fp3_1,
          // this.fp3_2, ...];" - the JS idiom for a dispatch table it later
          // invokes with an explicit `this` via "fn.call(this, ...)" (see
          // the ".call(thisArg, ...)" handling in transformCallExpression,
          // its counterpart). Perl has no equivalent of a bare unbound
          // method reference - "$self->{'property'}" (the plain-field
          // fallback just below) is always undef for a real method (no
          // class here backs a method name with an identically-named hash
          // field too), so every later call through it died "Can't call
          // method ... on an undefined value". "$self->can('property')"
          // returns the actual method as a coderef, callable exactly like
          // the JS pattern once an explicit invocant is supplied.
          if (this.allPlainClassMethodNames && this.allPlainClassMethodNames.has(node.property)) {
            return new PerlMemberAccess(
              new PerlIdentifier('self', '$'),
              new PerlCall(new PerlIdentifier('can'), [PerlLiteral.String(node.property, "'")]),
              '->'
            );
          }

          // Plain field: this.property -> $self->{'property'}
          return new PerlSubscript(
            new PerlIdentifier('self', '$'),
            PerlLiteral.String(node.property, "'"),
            'hash',
            true
          );

        case 'ThisMethodCall':
          // this.method(args) -> $self->method(args)
          const thisArgs = (node.arguments || []).map(a => this.transformExpression(a));
          // this.field(args) where "field" holds a plain code reference
          // (see codeRefFieldNames' doc comment) -> $self->{'field'}->(args),
          // not a real method call - there's no "sub field" to dispatch to.
          if (this.codeRefFieldNames && this.codeRefFieldNames.has(node.method)) {
            return new PerlMemberAccess(
              new PerlSubscript(new PerlIdentifier('self', '$'), PerlLiteral.String(node.method, "'"), 'hash', true),
              new PerlCall(null, thisArgs),
              '->'
            );
          }
          return new PerlMemberAccess(
            new PerlIdentifier('self', '$'),
            new PerlCall(new PerlIdentifier(node.method), thisArgs),
            '->'
          );

        case 'ParentConstructorCall':
          // super() -> $self->SUPER::new(@_) or $class->SUPER::new(args)
          const superCtorArgs = (node.arguments || []).map(a => this.transformExpression(a));
          return new PerlCall(
            new PerlMemberAccess(
              new PerlIdentifier('class', '$'),
              new PerlIdentifier('SUPER::new'),
              '->'
            ),
            superCtorArgs.length > 0 ? superCtorArgs : [new PerlIdentifier('_', '@')]
          );

        case 'ParentBuildCall': {
          // super(args) inside a constructor being converted to BUILD ->
          // $self->SUPER::BUILD(args) - see transformSuperCallsForBuild.
          const superBuildArgs = (node.arguments || []).map(a => this.transformExpression(a));
          return new PerlCall(
            new PerlMemberAccess(
              new PerlIdentifier('self', '$'),
              new PerlIdentifier('SUPER::BUILD'),
              '->'
            ),
            superBuildArgs
          );
        }

        case 'ParentMethodCall':
          // super.method(args) -> $self->SUPER::method(args)
          const superArgs = (node.arguments || []).map(a => this.transformExpression(a));
          return new PerlCall(
            new PerlMemberAccess(
              new PerlIdentifier('self', '$'),
              new PerlIdentifier('SUPER::' + node.method),
              '->'
            ),
            superArgs
          );

        case 'ArrayLength': {
          // For strings: str.length -> length($str)
          // For arrays: arr.length -> scalar(@arr)
          // For objects structurally known to carry a literal "length" field
          // (e.g. LZ-family match-finder results: { distance, length }) ->
          // $obj->{'length'} - a plain hash key, not the array/string length.
          const arrExpr = this.transformExpression(node.array);
          if (this.isStringType(node.array)) {
            return new PerlCall('length', [arrExpr]);
          }
          if (this._isLengthFieldObject(node.array)) {
            return new PerlSubscript(arrExpr, PerlLiteral.String('length', "'"), 'hash', true);
          }
          // Neither structural check above could statically prove the
          // receiver's type - most commonly a local variable assigned from
          // one of two (or more) branches whose static string-returning-ness
          // isStringType's necessarily-conservative structural checks can't
          // fully chase (e.g. classical/bazeries.js's "encryptBazeries(
          // plaintext, key) { if (...) return plaintext; ...; return this.
          // reinsertNonLetters(plaintext, ...); }", where the "return
          // plaintext" guard's string-ness is only provable by chaining
          // through *another* method's argument usage, several call-site
          // hops deeper than the same-method-body evidence isStringType/
          // _inferStringParamsFromUsage collect). Rather than guessing
          // "array" and dying at runtime ("Can't use string ... as an ARRAY
          // ref") whenever that guess is wrong, defer the array-vs-string
          // choice to actual runtime data, exactly mirroring JS's own
          // polymorphic ".length" (which Just Works on both) - a real
          // arrayref always satisfies ref($x) eq 'ARRAY', so this is a pure
          // safety net with no behavior change for the (overwhelmingly
          // common) already-correctly-inferred-array case.
          //
          // arrExpr is referenced twice in the ternary below (once for the
          // ref() type-check, once for the actual length call) - evaluated
          // through a "my $tmp = arrExpr;" do-block first whenever it isn't
          // a side-effect-free simple reference, so a receiver like
          // "this.nextChunk().length" (a mutating iterator-style call)
          // isn't silently invoked twice.
          const isSimpleExpr = ['Identifier', 'Literal', 'Grouped', 'Subscript', 'MemberAccess'].includes(arrExpr.nodeType);
          const lengthTernary = (ref) => new PerlConditional(
            new PerlBinaryExpression(new PerlCall('ref', [ref]), 'eq', PerlLiteral.String('ARRAY', "'")),
            new PerlCall('scalar', [this.wrapArrayDeref(ref)]),
            new PerlCall('length', [ref])
          );
          if (isSimpleExpr) return lengthTernary(arrExpr);
          const tmpName = `_al_len${this._arrayLengthTmpCounter = (this._arrayLengthTmpCounter || 0) + 1}`;
          const tmpIdent = new PerlIdentifier(tmpName, '$');
          const block = new PerlBlock([
            new PerlVarDeclaration('my', tmpName, '$', arrExpr),
            new PerlExpressionStatement(lengthTernary(tmpIdent))
          ]);
          return new PerlCall('do', [block]);
        }

        // ========================[ Cast IL Node Types ]========================

        case 'Cast': {
          // OpCodes.ToUint32(x) -> OpCodes::u32mask($x) (for uint32)
          // OpCodes.ToUint8(x) -> ($x) & 0xFF (for uint8)
          // OpCodes.ToInt32(x) -> unpack('l', pack('L', $x)) (for int32)
          // Note: IL Cast node can have value, argument, or arguments[0]
          const castArg = node.value || node.argument || (node.arguments && node.arguments[0]);
          const castVal = this.transformExpression(castArg);
          switch (node.targetType) {
            case 'uint32':
              // castVal sometimes derives from a raw (non-Math.imul/
              // OpCodes.Mul32) multiplication - see transformBinaryExpression's
              // '*' case - deliberately forced through Perl floating-point
              // arithmetic to reproduce JS's IEEE-754 double rounding of
              // "a * b" once the product exceeds 2**53. A plain "& 0xFFFFFFFF"
              // is exact for a native Perl integer, but converting such a
              // large NV back with Perl's native "&" was observed to silently
              // corrupt low-order bits (see u32mask's doc comment in
              // PerlEmitter.js's emitOpCodesRuntimeStub) - route through the
              // POSIX::fmod-backed safe helper in that specific case. Every
              // *other* value reaching a uint32 cast (e.g. Whirlpool's
              // "ToUint32(~pos)") is a genuine Perl native integer (IV/UV),
              // for which "& 0xFFFFFFFF" is already exact regardless of
              // magnitude - forcing those through u32mask's fmod would
              // instead *introduce* precision loss (an unwanted IV/UV -> NV
              // round-trip on an already-exact 64-bit-wide value), which is
              // exactly what regressed hash/whirlpool.js when this was
              // applied unconditionally.
              if (this._containsForcedDoubleMultiply(castVal)) {
                this.usesOpCodesRuntimeFallback = true;
                return new PerlCall(
                  new PerlMemberAccess(new PerlIdentifier('OpCodes'), new PerlIdentifier('u32mask'), '::'),
                  [castVal]
                );
              }
              return new PerlBinaryExpression(
                new PerlGrouped(castVal),
                '&',
                PerlLiteral.Number(0xFFFFFFFF)
              );
            case 'uint8':
              return new PerlBinaryExpression(
                new PerlGrouped(castVal),
                '&',
                PerlLiteral.Number(0xFF)
              );
            case 'uint16':
              return new PerlBinaryExpression(
                new PerlGrouped(castVal),
                '&',
                PerlLiteral.Number(0xFFFF)
              );
            // 'int' is OpCodes.ToInt (== JS's "x | 0", i.e. ToInt32) - a
            // distinct targetType string from 'int32' (OpCodes.ToInt32),
            // but identical signed-32-bit-wraparound semantics, so it must
            // be handled the same way. Previously fell through to
            // "default: return castVal" - a complete no-op that left
            // "OpCodes.ToInt(this._state + 0x6D2B79F5)" (random/
            // mulberry32.js's Weyl-sequence state update) accumulating
            // without ever wrapping at 32 bits, corrupting every
            // subsequent Math.imul/shift derived from that state.
            case 'int':
            case 'int32': {
              // Truncate to a 32-bit word via pack/unpack (exact, unlike
              // relying on Perl's native wider-than-32-bit "*"/"+"
              // results). $x is only routed through the fmod-backed
              // u32mask when it actually derives from a forced-double
              // multiply (see the 'uint32' case above for why); otherwise
              // it's a genuine native integer, for which pack('L', ...) is
              // already exact.
              //
              // Unpacked as unsigned ('L', not 'l'): every other 32-bit
              // word elsewhere in this codebase's Perl output is the
              // unsigned 0..2**32-1 form (whatever the ubiquitous
              // "& 0xFFFFFFFF" masking idiom produces) - a signed result
              // here is the one place that would break that convention,
              // and a *negative* Perl scalar reaching a later "+"/"^"/etc.
              // (which treat a negative operand as its full 64-bit two's-
              // complement pattern, not a 32-bit one) reintroduces
              // "garbage" high bits into any later accumulation - see
              // Math.imul's identical fix (the 'imul' case above) for a
              // worked example (random/splitmix32.js's/xoshiro-plusplus.
              // js's "state = OpCodes.ToInt(state + GOLDEN_GAMMA)" Weyl-
              // sequence accumulator). The bit pattern is identical either
              // way (pack('l',X) and pack('L',X) produce the same bytes
              // for the same integer X mod 2**32), so this changes no
              // numeric (mod 2**32) result, only which representation
              // propagates forward safely.
              let maskedVal = castVal;
              if (this._containsForcedDoubleMultiply(castVal)) {
                this.usesOpCodesRuntimeFallback = true;
                maskedVal = new PerlCall(
                  new PerlMemberAccess(new PerlIdentifier('OpCodes'), new PerlIdentifier('u32mask'), '::'),
                  [castVal]
                );
              }
              return new PerlCall('unpack', [
                PerlLiteral.String('L', "'"),
                new PerlCall('pack', [PerlLiteral.String('L', "'"), maskedVal])
              ]);
            }
            case 'int16':
              // unpack('s', pack('S', $x & 0xFFFF)) - signed 16-bit,
              // matching the int32 case's pack/unpack round-trip pattern.
              return new PerlCall('unpack', [
                PerlLiteral.String('s', "'"),
                new PerlCall('pack', [
                  PerlLiteral.String('S', "'"),
                  new PerlBinaryExpression(new PerlGrouped(castVal), '&', PerlLiteral.Number(0xFFFF))
                ])
              ]);
            case 'int8':
              // unpack('c', pack('C', $x & 0xFF)) - signed 8-bit.
              return new PerlCall('unpack', [
                PerlLiteral.String('c', "'"),
                new PerlCall('pack', [
                  PerlLiteral.String('C', "'"),
                  new PerlBinaryExpression(new PerlGrouped(castVal), '&', PerlLiteral.Number(0xFF))
                ])
              ]);
            default:
              // Unknown cast type - return value as-is
              return castVal;
          }
        }

        // ========================[ Math IL Node Types ]========================

        case 'Floor': {
          // Math.imul(a, b) returns a *signed* int32 in real JS, but this
          // transpiler's own Math.imul lowering (the 'imul' MathCall case)
          // always yields the equivalent *unsigned* 0..2**32-1 Perl value
          // instead - a deliberate choice matching the rest of this
          // codebase's "every 32-bit word is represented unsigned"
          // convention (see that case's doc comment). "Math.floor((sum
          // including an imul result) / 2**32)" is the one place that
          // signedness actually changes the numeric answer: it's the
          // standard "32-bit-halves multiply-with-carry" idiom for
          // extracting the carry out of a 32-bit addition (see
          // algorithms/random/mwc.js's _next64(), "let r2 =
          // ToUint32(highCarry) + Math.floor((lowCarry + highMul) /
          // 0x100000000);"), and it's only correct when the imul term's
          // ORIGINAL (possibly negative) value participates in the
          // division - the unsigned (>= 0) form used everywhere else is
          // exactly 2**32 too large whenever the true signed value was
          // negative, so floor(.../2**32) silently comes out exactly 1 too
          // high in that case (this was reaching the harness as a
          // one-bit-off-by-a-carry vector mismatch several _next64() calls
          // downstream, not an obvious crash). Detect any imul-derived
          // operand(s) directly inside a "+" sum being floor-divided by
          // 2**32 and subtract 1 for each whose unsigned representative
          // has its top bit set (i.e. was negative as a signed int32).
          const transformedArg = this.transformExpression(node.argument);
          const isDivBy2To32Literal = (n) => n && (n.type === 'Literal' || n.type === 'NumberLiteral') && Number(n.value) === 4294967296;
          let sumNode = null;
          if (node.argument?.type === 'BinaryExpression' && node.argument.operator === '/' && isDivBy2To32Literal(node.argument.right))
            sumNode = node.argument.left;
          if (sumNode && this._imulResultVarNames && this._imulResultVarNames.size > 0) {
            const imulOperands = [];
            this._collectImulSumOperands(sumNode, imulOperands);
            if (imulOperands.length > 0) {
              let result = new PerlCall('int', [transformedArg]);
              for (const opNode of imulOperands) {
                const opExpr = this.transformExpression(opNode);
                const correction = new PerlConditional(
                  new PerlBinaryExpression(opExpr, '>=', PerlLiteral.Number(2147483648)),
                  PerlLiteral.Number(1),
                  PerlLiteral.Number(0)
                );
                result = new PerlBinaryExpression(result, '-', new PerlGrouped(correction));
              }
              return result;
            }
          }
          return new PerlCall('int', [transformedArg]);
        }

        case 'Ceil':
          // ceil(x) -> POSIX::ceil(x)
          this.addRequiredModule('POSIX');
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("ceil"), "::"), [this.transformExpression(node.argument)]);

        case 'Round':
          // round(x) -> POSIX::round(x)
          this.addRequiredModule('POSIX');
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("round"), "::"), [this.transformExpression(node.argument)]);

        case 'Abs':
          return new PerlCall('abs', [this.transformExpression(node.argument)]);

        case 'Min':
          // Use fully qualified name to work across package boundaries
          this.addRequiredModule('List::Util', 'min');
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("min"), "::"), (node.arguments || []).map(a => this.transformExpression(a)));

        case 'Max':
          // Use fully qualified name to work across package boundaries
          this.addRequiredModule('List::Util', 'max');
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("max"), "::"), (node.arguments || []).map(a => this.transformExpression(a)));

        case 'Pow':
          // Math.pow(a, b) -> a ** b
          const base = this.transformExpression(node.arguments[0]);
          const exp = this.transformExpression(node.arguments[1]);
          return new PerlBinaryExpression(base, '**', exp);

        case 'Sqrt':
          return new PerlCall('sqrt', [this.transformExpression(node.argument)]);

        case 'Log':
          return new PerlCall('log', [this.transformExpression(node.argument)]);

        case 'Log2':
          // Math.log2(x) -> log(x) / log(2)
          return new PerlBinaryExpression(
            new PerlCall('log', [this.transformExpression(node.argument)]),
            '/',
            new PerlCall('log', [PerlLiteral.Number(2)])
          );

        case 'Log10':
          // Math.log10(x) -> log(x) / log(10)
          return new PerlBinaryExpression(
            new PerlCall('log', [this.transformExpression(node.argument)]),
            '/',
            new PerlCall('log', [PerlLiteral.Number(10)])
          );

        case 'Exp':
          return new PerlCall('exp', [this.transformExpression(node.argument)]);

        case 'Sin':
          return new PerlCall('sin', [this.transformExpression(node.argument)]);

        case 'Cos':
          return new PerlCall('cos', [this.transformExpression(node.argument)]);

        case 'Tan':
          // tan(x) -> sin(x)/cos(x)
          return new PerlBinaryExpression(
            new PerlCall('sin', [this.transformExpression(node.arguments?.[0] || node.value)]),
            '/',
            new PerlCall('cos', [this.transformExpression(node.arguments?.[0] || node.value)])
          );

        case 'Asin':
          // asin(x) -> atan2(x, sqrt(1 - x*x))
          return new PerlCall('atan2', [
            this.transformExpression(node.arguments?.[0] || node.value),
            new PerlCall('sqrt', [new PerlBinaryExpression(
              PerlLiteral.Number(1),
              '-',
              new PerlBinaryExpression(
                this.transformExpression(node.arguments?.[0] || node.value),
                '*',
                this.transformExpression(node.arguments?.[0] || node.value)
              )
            )])
          ]);

        case 'Acos':
          // acos(x) -> atan2(sqrt(1 - x*x), x)
          return new PerlCall('atan2', [
            new PerlCall('sqrt', [new PerlBinaryExpression(
              PerlLiteral.Number(1),
              '-',
              new PerlBinaryExpression(
                this.transformExpression(node.arguments?.[0] || node.value),
                '*',
                this.transformExpression(node.arguments?.[0] || node.value)
              )
            )]),
            this.transformExpression(node.arguments?.[0] || node.value)
          ]);

        case 'Atan':
          // atan(x) -> atan2(x, 1)
          return new PerlCall('atan2', [
            this.transformExpression(node.arguments?.[0] || node.value),
            PerlLiteral.Number(1)
          ]);

        case 'Atan2':
          // atan2(y, x) -> atan2(y, x) (built-in)
          return new PerlCall('atan2', [
            this.transformExpression(node.arguments?.[0] || node.y),
            this.transformExpression(node.arguments?.[1] || node.x)
          ]);

        case 'Sinh':
          // sinh(x) -> POSIX::sinh(x)
          this.addRequiredModule('POSIX');
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("sinh"), "::"), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Cosh':
          // cosh(x) -> POSIX::cosh(x)
          this.addRequiredModule('POSIX');
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("cosh"), "::"), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Tanh':
          // tanh(x) -> POSIX::tanh(x)
          this.addRequiredModule('POSIX');
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("tanh"), "::"), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Cbrt':
          // cbrt(x) -> x ** (1/3)
          return new PerlBinaryExpression(
            this.transformExpression(node.arguments?.[0] || node.value),
            '**',
            new PerlGrouped(new PerlBinaryExpression(PerlLiteral.Number(1), '/', PerlLiteral.Number(3)))
          );

        case 'Hypot': {
          // hypot(a, b) -> sqrt(a*a + b*b)
          const hypotArgs = (node.arguments || []).map(a => this.transformExpression(a));
          return new PerlCall('sqrt', [new PerlBinaryExpression(
            new PerlBinaryExpression(hypotArgs[0], '*', hypotArgs[0]),
            '+',
            new PerlBinaryExpression(hypotArgs[1], '*', hypotArgs[1])
          )]);
        }

        case 'Sign':
          // sign(x) -> (x <=> 0)
          return new PerlGrouped(new PerlBinaryExpression(
            this.transformExpression(node.arguments?.[0] || node.value),
            '<=>',
            PerlLiteral.Number(0)
          ));

        case 'Fround':
          // fround(x) -> x (no native equivalent, pass through)
          return this.transformExpression(node.arguments?.[0] || node.value);

        case 'MathConstant': {
          // Math constants -> Perl expressions
          switch (node.name) {
            case 'PI':
              return new PerlBinaryExpression(PerlLiteral.Number(4), '*', new PerlCall('atan2', [PerlLiteral.Number(1), PerlLiteral.Number(1)]));
            case 'E':
              return new PerlCall('exp', [PerlLiteral.Number(1)]);
            case 'LN2':
              return new PerlCall('log', [PerlLiteral.Number(2)]);
            case 'LN10':
              return new PerlCall('log', [PerlLiteral.Number(10)]);
            case 'LOG2E':
              return new PerlBinaryExpression(PerlLiteral.Number(1), '/', new PerlCall('log', [PerlLiteral.Number(2)]));
            case 'LOG10E':
              return new PerlBinaryExpression(PerlLiteral.Number(1), '/', new PerlCall('log', [PerlLiteral.Number(10)]));
            case 'SQRT2':
              return new PerlCall('sqrt', [PerlLiteral.Number(2)]);
            case 'SQRT1_2':
              return new PerlCall('sqrt', [PerlLiteral.Number(0.5)]);
            default:
              return PerlLiteral.Number(node.value);
          }
        }

        case 'NumberConstant': {
          // Number constants -> Perl values
          switch (node.name) {
            case 'POSITIVE_INFINITY':
              return new PerlRawCode('9e999');
            case 'NEGATIVE_INFINITY':
              return new PerlRawCode('-9e999');
            case 'NaN':
              return new PerlRawCode("('NaN' + 0)");
            case 'MAX_SAFE_INTEGER':
              return PerlLiteral.Number(9007199254740991);
            case 'MIN_SAFE_INTEGER':
              return PerlLiteral.Number(-9007199254740991);
            case 'EPSILON':
              return PerlLiteral.Number(2.220446049250313e-16);
            default:
              return PerlLiteral.Number(node.value);
          }
        }

        case 'InstanceOfCheck': {
          // value instanceof ClassName -> ref($value) eq 'ClassName'
          const instVal = this.transformExpression(node.value);
          // Always use string literal for class name in ref() comparison
          const className = node.className?.name || node.className?.value || (typeof node.className === 'string' ? node.className : null);
          const instClassStr = className
            ? PerlLiteral.String(className, "'")
            : PerlLiteral.String(String(this.transformExpression(node.className)), "'");
          return new PerlBinaryExpression(
            new PerlCall('ref', [instVal]),
            'eq',
            instClassStr
          );
        }

        case 'Power':
          // Math.pow(base, exponent) -> base ** exponent
          return new PerlBinaryExpression(
            this.transformExpression(node.base),
            '**',
            this.transformExpression(node.exponent)
          );

        // ========================[ OpCodes Call fallback ]========================

        case 'OpCodesCall': {
          // Unknown OpCodes method - handle common ones or prefix with OpCodes::
          const methodName = node.method;
          const opArgs = (node.arguments || []).map(a => this.transformExpression(a));

          // CopyArray - shallow copy of array
          if (methodName === 'CopyArray')
            return new PerlArray([new PerlUnaryExpression('@', opArgs[0], true)]);

          // FillArray - fill array with value
          if (methodName === 'FillArray' || methodName === 'Fill')
            return new PerlArray([
              new PerlBinaryExpression(
                new PerlGrouped(opArgs[1] || opArgs[0]),
                'x',
                opArgs[2] || opArgs[1] || PerlLiteral.Number(1)
              )
            ]);

          // BitMask - create bitmask
          if (methodName === 'BitMask')
            return new PerlBinaryExpression(
              new PerlBinaryExpression(PerlLiteral.Number(1), '<<', opArgs[0]),
              '-',
              PerlLiteral.Number(1)
            );

          // CompareArrays - compare two arrays
          if (methodName === 'CompareArrays') {
            const joinA = new PerlCall('join', [PerlLiteral.String('', "'"), new PerlUnaryExpression('@', opArgs[0], true)]);
            const joinB = new PerlCall('join', [PerlLiteral.String('', "'"), new PerlUnaryExpression('@', opArgs[1], true)]);
            return new PerlBinaryExpression(joinA, 'eq', joinB);
          }

          // CreateBitStream - see the identical (and more extensively
          // commented) case in transformOpCodesCall. The shared IL builder
          // pre-recognizes a *direct* "OpCodes.Method(...)" call (object
          // literally named "OpCodes") into this 'OpCodesCall' IL node
          // before this transformer ever sees a plain CallExpression, so
          // transformOpCodesCall's own copy of this check (reached only for
          // shapes the IL builder does NOT recognize this way, e.g. calls
          // through a local OpCodes-alias variable) never actually fires
          // for "OpCodes.CreateBitStream()" itself - this copy is the one
          // that matters.
          if (methodName === 'CreateBitStream') {
            this.usesBitStreamClass = true;
            const newCall = new PerlCall(new PerlIdentifier('new'), opArgs);
            newCall.isMethodCall = true;
            return new PerlMemberAccess(new PerlIdentifier('_OpCodesBitStream', ''), newCall, '->');
          }

          // Default: prefix with OpCodes:: package name, backed by the
          // inline runtime stub emitted when this flag is set (see
          // transformOpCodesCall / PerlEmitter.js emitOpCodesRuntimeStub).
          this.usesOpCodesRuntimeFallback = true;
          return new PerlCall(
            new PerlMemberAccess(new PerlIdentifier('OpCodes'), new PerlIdentifier(methodName.toLowerCase()), '::'),
            opArgs
          );
        }

        // ========================[ Array IL Node Types ]========================

        case 'ArraySlice': {
          // array.slice(start?, end?) -> [@{$array}] or [@{$array}[start..end-1]]
          // NOTE: Slice returns list, so we wrap in [...] to get arrayref
          const sliceArr = this.transformExpression(node.array);
          if (!node.start && !node.end) {
            // No args: copy entire array
            return new PerlArray([this.wrapArrayDeref(sliceArr)]);
          }
          return this._buildArraySliceExpr(sliceArr,
            node.start ? this.transformExpression(node.start) : null,
            node.end ? this.transformExpression(node.end) : null);
        }

        case 'ArrayAppend': {
          // array.push(val) -> push(@arr, $val) or push(@{$ref}, $val)
          // array.push(...data) -> push(@{$arr}, @$data)
          // array.push(a, b, c) -> push(@{$arr}, $a, $b, $c) - all arguments
          // must be preserved (node.values holds the full argument list;
          // node.value alone is only the first arg and would silently drop
          // the rest for multi-arg push() calls).
          const appendArr = this.transformExpression(node.array);
          const pushArgs = (node.values && node.values.length) ? node.values : [node.value];
          const valueExprs = pushArgs.map(v => {
            if (v && v.type === 'SpreadElement') {
              // Spread element: push(@arr, @$data) - dereference the spread source
              const spreadArg = this.transformExpression(v.argument);
              return new PerlUnaryExpression('@', spreadArg, true);
            }
            return this.transformExpression(v);
          });
          return new PerlCall('push', [
            this.wrapArrayDeref(appendArr),
            ...valueExprs
          ]);
        }

        case 'ArrayPop': {
          // array.pop() -> pop(@arr) or pop(@{$ref})
          const popArr = this.transformExpression(node.array);
          return new PerlCall('pop', [this.wrapArrayDeref(popArr)]);
        }

        case 'ArrayShift': {
          // array.shift() -> shift(@arr) or shift(@{$ref})
          const shiftArr = this.transformExpression(node.array);
          return new PerlCall('shift', [this.wrapArrayDeref(shiftArr)]);
        }

        case 'ArrayUnshift': {
          // array.unshift(val) -> unshift(@arr, $val)
          const unshiftArr = this.transformExpression(node.array);
          return new PerlCall('unshift', [
            this.wrapArrayDeref(unshiftArr),
            this.transformExpression(node.value)
          ]);
        }

        case 'ArrayConcat': {
          // array.concat(...others) -> [@arr1, @arr2, ...]
          const concatFirst = this.wrapArrayDeref(this.transformExpression(node.array));
          const concatRest = (node.arrays || []).map(a =>
            this.wrapArrayDeref(this.transformExpression(a))
          );
          return new PerlArray([concatFirst, ...concatRest]);
        }

        case 'ArrayJoin': {
          // array.join(sep) -> join($sep, @arr)
          const joinArr = this.transformExpression(node.array);
          const joinSep = node.separator
            ? this.transformExpression(node.separator)
            : PerlLiteral.String('', "'");
          return new PerlCall('join', [joinSep, this.wrapArrayDeref(joinArr)]);
        }

        case 'ArrayReverse': {
          // array.reverse() -> [reverse @arr]
          const revArr = this.transformExpression(node.array);
          return new PerlArray([
            new PerlCall('reverse', [this.wrapArrayDeref(revArr)])
          ]);
        }

        case 'ArraySort': {
          // array.sort(fn?) -> [sort @arr]
          const sortArr = this.transformExpression(node.array);
          if (node.compareFn) {
            return new PerlArray([
              new PerlCall('sort', [
                this.transformExpression(node.compareFn),
                this.wrapArrayDeref(sortArr)
              ])
            ]);
          }
          return new PerlArray([
            new PerlCall('sort', [this.wrapArrayDeref(sortArr)])
          ]);
        }

        case 'ArrayIndexOf': {
          // array.indexOf(val) -> simplified: first index or -1
          this.addRequiredModule('List::Util', 'first');
          const idxArr = this.transformExpression(node.array);
          const idxVal = this.transformExpression(node.value);
          // Use inline loop to find index
          const forLoop = new PerlFor();
          forLoop.isCStyle = true;
          forLoop.init = new PerlVarDeclaration('my', 'i', '$', PerlLiteral.Number(0));
          forLoop.condition = new PerlBinaryExpression(
            new PerlIdentifier('i', '$'),
            '<',
            new PerlCall('scalar', [this.wrapArrayDeref(idxArr)])
          );
          forLoop.increment = new PerlUnaryExpression('++', new PerlIdentifier('i', '$'), false);
          forLoop.body = new PerlBlock([
            new PerlIf(
              new PerlBinaryExpression(
                new PerlSubscript(idxArr, new PerlIdentifier('i', '$'), 'array'),
                'eq',
                idxVal
              ),
              new PerlBlock([
                new PerlExpressionStatement(new PerlAssignment(new PerlIdentifier('idx', '$'), '=', new PerlIdentifier('i', '$'))),
                new PerlLast()
              ])
            )
          ]);
          return new PerlCall('do', [new PerlBlock([
            new PerlVarDeclaration('my', 'idx', '$', PerlLiteral.Number(-1)),
            forLoop,
            new PerlExpressionStatement(new PerlIdentifier('idx', '$'))
          ])]);
        }

        case 'ArrayIncludes': {
          // Check if this is actually a string.includes() call
          // The IL may generate ArrayIncludes for both array and string includes
          const inclVal = this.transformExpression(node.value);

          // If the array is a string method call (toLowerCase, etc.) or string type, use index()
          const arrayNode = node.array;
          const isStringContext = this.isStringType(arrayNode) ||
            (arrayNode && arrayNode.type === 'CallExpression' &&
             arrayNode.callee && arrayNode.callee.property &&
             (arrayNode.callee.property.name || arrayNode.callee.property.value) &&
             ['toLowerCase', 'toUpperCase', 'trim', 'toString', 'substring', 'substr', 'slice'].includes(arrayNode.callee.property.name || arrayNode.callee.property.value));

          if (isStringContext) {
            // string.includes(val) -> index($str, $val) >= 0
            const str = this.transformExpression(arrayNode);
            return new PerlBinaryExpression(
              new PerlCall('index', [str, inclVal]),
              '>=',
              PerlLiteral.Number(0)
            );
          }

          // array.includes(val) -> grep { $_ == $val } @arr
          const inclArr = this.transformExpression(arrayNode);
          return new PerlCall('grep', [
            new PerlBlock([new PerlExpressionStatement(
              new PerlBinaryExpression(new PerlIdentifier('_', '$'), '==', inclVal)
            )]),
            this.wrapArrayDeref(inclArr)
          ]);
        }

        case 'ArraySplice': {
          // array.splice(start, deleteCount?, ...items)
          // JS Array.prototype.splice() always returns an array of the
          // removed elements. Perl's splice() only does that in list
          // context - in scalar context (e.g. "my $x = splice(...)", the
          // overwhelmingly common way this return value gets used here)
          // it instead returns just the LAST removed element, silently
          // turning "the removed block" into "one stray byte" everywhere
          // the result is consumed as an array afterwards. Wrapping in
          // [...] forces list context and yields an arrayref, matching
          // JS semantics regardless of how the caller uses the result.
          const splArr = this.transformExpression(node.array);
          const splArgs = [this.wrapArrayDeref(splArr)];
          // The IL parser sets an omitted optional argument (e.g. "array.
          // splice(start)" with no deleteCount/items - see ecc/spinal-
          // code.js's "candidates.splice(this.maxBubbles);", deleting
          // through the end of the array) to an explicit `null`, not
          // `undefined` - "!== undefined" alone let a bare `null` straight
          // through to transformExpression(null), which itself returns a
          // bare JS `null` (not a PerlNode) - silently pushing a raw
          // `null` into splArgs, which later blew up code generation
          // entirely ("Cannot read properties of null (reading 'spread')"
          // in PerlEmitter's emitCall, which assumes every args[] entry is
          // a real AST node).
          if (node.start !== undefined && node.start !== null) splArgs.push(this.transformExpression(node.start));
          if (node.deleteCount !== undefined && node.deleteCount !== null) splArgs.push(this.transformExpression(node.deleteCount));
          if (node.items) {
            for (const item of node.items) {
              splArgs.push(this.transformExpression(item));
            }
          }
          return new PerlArray([new PerlCall('splice', splArgs)]);
        }

        case 'ArrayFill': {
          // array.fill(value, start?, end?) -> simplified: fill all with value
          const fillArr = this.transformExpression(node.array);
          const fillVal = this.transformExpression(node.value);
          const fillLen = new PerlCall('scalar', [this.wrapArrayDeref(fillArr)]);
          return new PerlArray([
            new PerlBinaryExpression(new PerlGrouped(fillVal), 'x', fillLen)
          ]);
        }

        case 'ArrayLiteral':
          // Array literal with elements
          return new PerlArray((node.elements || []).map(e => this.transformExpression(e)));

        case 'ArrayCreation':
          // new Array(size) -> [(undef) x size]
          if (node.size) {
            return new PerlArray([
              new PerlBinaryExpression(
                new PerlGrouped(PerlLiteral.Undef()),
                'x',
                this.transformExpression(node.size)
              )
            ]);
          }
          return new PerlArray([]);

        case 'TypedArrayCreation': {
          // new Uint8Array(N) zero-fills N elements, but new
          // Uint8Array(someArrayOrBuffer) instead COPIES the source's
          // elements - two entirely different constructor overloads that
          // both parse to this same IL node (see type-aware-transpiler.js
          // _transformNewExpression's createTypedArrayNode helper, which
          // sets a `buffer` field specifically to disambiguate them: it's
          // only set when the argument is an Identifier/MemberExpression,
          // i.e. plausibly an existing array rather than a numeric length).
          // Treating the copy-from-array form as a zero-fill-by-length
          // (using the array reference's address as the length!) silently
          // produces a gigantic bogus array and exhausts memory.
          // type-aware-transpiler.js's createTypedArrayNode heuristic
          // (looksLikeSize) guesses copy-vs-zero-fill from the argument's
          // *shape* (Identifier/MemberExpression -> node.buffer i.e.
          // "plausibly an existing array"; anything else, INCLUDING a
          // CallExpression like "key.slice(0, 16)" -> node.size i.e.
          // "plausibly a numeric length") and gets both directions wrong
          // sometimes: a plain byte-count property name it doesn't
          // recognize as size-like (e.g. "new Uint8Array(algorithm.rate)")
          // is misdetected as a buffer to copy, dying with "Can't use
          // string ... as an ARRAY ref"; conversely a .slice()/.subarray()
          // call - unambiguously an array copy source, but not an
          // Identifier/MemberExpression - is misdetected as a numeric
          // length, and "(0) x <arrayref>" numifies the reference into its
          // memory address and tries to allocate that many elements,
          // instantly exhausting memory ("Out of memory!" - this is exactly
          // how Kuznyechik's "new Uint8Array(key.slice(0, 16))" key
          // expansion broke). Perl's dynamic typing lets this be resolved
          // at runtime instead of relying on either static heuristic: copy
          // if the value actually is an arrayref when this executes,
          // otherwise zero-fill that many elements. Apply uniformly
          // whichever field the shared parser populated. Evaluated into a
          // temporary once to avoid double-evaluating a side-effecting
          // source expression (e.g. a CallExpression).
          if (node.buffer || node.size) {
            // "new TypedArray(someTypedArray.buffer[, byteOffset,
            // byteLength])" - reinterpreting an existing typed array's
            // backing bytes as a different element type (e.g.
            // kdf/argon2.js's "const BUF8 = new Uint8Array(BUF.buffer)",
            // aead/deoxys-ii.js's "new Uint8Array(counter.buffer)",
            // hash/lsh.js's "new Uint32Array(this.sub_msgs.buffer, 0, 8)").
            // Every typed array is emulated here as a plain Perl arrayref,
            // with no separate ArrayBuffer object behind it - the ".buffer"
            // accessor itself has no corresponding representation, so
            // transforming it as an ordinary property read (the generic
            // MemberExpression path) tried a hash-key dereference
            // ("$X->{'buffer'}") on that arrayref and died "Not a HASH
            // reference" unconditionally, even when (as in argon2's BUF8)
            // the result was never subsequently read. Unwrapping ".buffer"
            // to the underlying array itself - skipping the accessor
            // entirely - lets the same copy-or-zero-fill logic below treat
            // it as copying from that array's current elements, which is
            // exactly right for a read-only byte-reinterpretation snapshot.
            // NOTE: byteOffset/byteLength (a 3-argument windowed view, as
            // in the lsh.js example) are silently dropped upstream by
            // type-aware-transpiler.js's createTypedArrayNode (only the
            // buffer argument survives into this IL node) and can't be
            // recovered here - the offsets are lost regardless of this
            // unwrap, so a windowed alias still isn't reproduced correctly,
            // but this at least avoids the unconditional crash for every
            // other ".buffer" shape (whole-buffer reinterpretation, the
            // overwhelmingly common case).
            //
            // GATED on the base being a CONFIRMED array/typed-array-shaped
            // field/variable (arrayFieldNames/_localArrayVarNames, the same
            // whole-file prescan isArrayContext() relies on) - ".buffer" is
            // also a perfectly ordinary, genuine field name in this
            // codebase for something that ISN'T a typed array (e.g.
            // hash/blake2.js's "this._hasher" is a Blake2bHasher class
            // *instance* with its own real ".buffer" byte-array field:
            // "hasherCopy.buffer = new Uint8Array(this._hasher.buffer)" -
            // there _hasher.buffer is a normal hash-key field read
            // ("$self->{'_hasher'}->{'buffer'}"), not an ArrayBuffer
            // accessor, and unwrapping it to "the whole _hasher object"
            // instead is wrong (it fed the entire hasher instance into the
            // copy-or-zero-fill check, previously causing an "Out of
            // memory!" runaway). Only unwrap when the base is positively
            // known to be array-shaped; otherwise fall through to the
            // ordinary MemberExpression transform unchanged (whatever it
            // already did before this fix, for every case not already
            // covered by the two known-safe examples above).
            let srcArg = node.buffer || node.size;
            if (srcArg && srcArg.type === 'MemberExpression' && !srcArg.computed) {
              const bufPropName = srcArg.property && (srcArg.property.name || srcArg.property.value);
              if (bufPropName === 'buffer') {
                const base = srcArg.object;
                // _isConfirmedArrayShapedBase only ever positively confirms
                // "this.field"/"const local = new Uint8Array(...)" shapes -
                // a plain function PARAMETER (e.g. kdf/argon2.js's "function
                // Hp(A, dkLen) { ... new Uint8Array(A.buffer, A.byteOffset,
                // A.byteLength); ... }") is never a `const`/`let` local
                // declaration, so it's never added to _localArrayVarNames
                // and the confirmed-shape check always failed for it,
                // leaving the generic MemberExpression fallback to try
                // "$A->{'buffer'}" and die "Not a HASH reference" - even
                // though every actual caller of Hp(...) in this file passes
                // a real typed-array-shaped value. The one known
                // false-positive risk this gate exists to avoid
                // (hash/blake2.js's "this._hasher.buffer", a genuine class-
                // instance field also named "buffer") is a ThisPropertyAccess/
                // "this.field" shape, not a bare identifier - so for a plain
                // Identifier base that isn't positively known to be
                // hash-shaped either, default to treating ".buffer" as the
                // typed-array-reinterpretation accessor (the overwhelmingly
                // likely meaning of "X.buffer" passed straight into a
                // TypedArray constructor).
                const isUnconfirmedPlainIdentifier = base?.type === 'Identifier' &&
                  !(this._localHashVarNames && this._localHashVarNames.has(base.name));
                if (this._isConfirmedArrayShapedBase(base) || isUnconfirmedPlainIdentifier)
                  srcArg = base;
              }
            }

            // Built as real PerlNode AST (PerlVarDeclaration/PerlConditional/
            // PerlBlock/...) rather than hand-formatting the source
            // sub-expression into a PerlRawCode template string: PerlNode
            // has no generic toString(), so "${source}" silently rendered
            // as the literal text "[object Object]" for anything beyond
            // simple literals/identifiers (e.g. an ArraySlice like
            // "this.inputBuffer.slice(b * 16, (b + 1) * 16)") - a hard
            // Perl parse/runtime error, not just a wrong value. Going
            // through the normal node tree instead lets the emitter's own
            // recursive emit() render the sub-expression correctly
            // regardless of complexity.
            const source = this.transformExpression(srcArg);
            const tmpName = `_ta_src${this._typedArraySrcCounter = (this._typedArraySrcCounter || 0) + 1}`;
            const tmpVar = new PerlIdentifier(tmpName, '$');
            const decl = new PerlVarDeclaration('my', tmpName, '$', source);
            const isArrayCheck = new PerlBinaryExpression(new PerlCall('ref', [tmpVar]), 'eq', PerlLiteral.String('ARRAY', "'"));
            const copyBranch = new PerlArray([new PerlUnaryExpression('@', tmpVar, true)]);
            const zeroFillBranch = new PerlArray([new PerlBinaryExpression(new PerlGrouped(PerlLiteral.Number(0)), 'x', tmpVar)]);
            const cond = new PerlConditional(isArrayCheck, copyBranch, zeroFillBranch);
            const block = new PerlBlock([decl, new PerlExpressionStatement(cond)]);
            return new PerlGrouped(new PerlCall('do', [block]));
          }
          return new PerlArray([]);
        }

        case 'BufferCreation':
          // new ArrayBuffer(size) -> array of zeros
          if (node.size) {
            return new PerlArray([
              new PerlBinaryExpression(
                new PerlGrouped(PerlLiteral.Number(0)),
                'x',
                this.transformExpression(node.size)
              )
            ]);
          }
          return new PerlArray([]);

        case 'DataViewCreation':
          // "new DataView(new ArrayBuffer(N))" - buffer created fresh,
          // inline, purely to be read/written through THIS DataView (e.g.
          // hash/blake.js's Merkle-Damgard length-suffix padding: "const
          // view = new DataView(new ArrayBuffer(16)); view.setUint32(8,
          // ...); ...; this.buffer[...] = view.getUint8(i);"). Every
          // DataView read/write (see the 'DataViewWrite'/'DataViewRead' IL
          // cases below) is emitted as Perl's substr()-based byte-string
          // splicing, which needs a plain SCALAR STRING - but the generic
          // BufferCreation case just above ("new ArrayBuffer(size) ->
          // array of zeros") emits an ARRAY reference "[(0) x size]"
          // instead, since a bare ArrayBuffer *without* an immediately-
          // wrapping DataView is instead typically re-wrapped by a typed
          // array (Uint32Array/Float64Array/...) that DOES need array
          // semantics (e.g. random/dsfmt.js's "new Uint32Array(buffer)"/
          // "new Float64Array(buffer)" aliasing the SAME buffer as two
          // different views - only possible to emulate as an array, not a
          // string). Passing the array through unchanged here (the
          // previous behavior) fed an arrayref straight into
          // substr($view, ...), which dies "Attempt to use reference as
          // lvalue in substr" - producing a hash/PRNG length-padding block
          // of all-zero/garbage bytes once that die was silently swallowed
          // by the harness's per-vector eval, corrupting the final digest.
          // Safe to special-case here (emit a plain null-byte string
          // instead) ONLY for this exact "argument is a fresh, inline
          // BufferCreation" shape - a DataView wrapping a SEPARATE,
          // already-declared buffer variable (e.g. random/ran0.js's/
          // ran1.js's/ran2.js's/ran3.js's "const view = new
          // DataView(buffer);", buffer declared earlier and never
          // otherwise re-wrapped) is untouched, still passed through as
          // whatever the buffer variable already resolved to.
          if (node.buffer && node.buffer.type === 'BufferCreation' && node.buffer.size) {
            const sizeExpr = this.transformExpression(node.buffer.size);
            return new PerlGrouped(new PerlBinaryExpression(
              PerlLiteral.String('\\0', '"'), 'x', sizeExpr
            ));
          }
          // new DataView(buffer) -> just use the buffer directly (Perl arrays work as views)
          if (node.buffer) {
            return this.transformExpression(node.buffer);
          }
          return new PerlArray([]);

        case 'MapCreation': {
          // new Map() -> {} (hash reference)
          // new Map([entries]) -> {k1 => v1, k2 => v2, ...}
          if (node.entries && node.entries.elements && node.entries.elements.length > 0) {
            const pairs = node.entries.elements.map(entry => {
              if (entry.elements && entry.elements.length >= 2) {
                const key = this.transformExpression(entry.elements[0]);
                const value = this.transformExpression(entry.elements[1]);
                // PerlHash expects { key, value } objects, not [key, value] arrays
                return { key, value };
              }
              return null;
            }).filter(p => p !== null);
            return new PerlHash(pairs);
          }
          return new PerlHash([]);
        }

        case 'SetCreation': {
          // new Set() -> {} (hash reference; membership = key presence, value
          // is always 1 - see the mapVarNames/setVarNames-driven "X.has(v)"/
          // "X.add(v)"/"X.delete(v)" method-call rewriting in
          // transformCallExpression, which reads/writes this same
          // presence-as-hash-key convention).
          // new Set([v1, v2, ...]) -> {v1 => 1, v2 => 1, ...}
          if (node.values && node.values.elements && node.values.elements.length > 0) {
            const pairs = node.values.elements.map(v => ({ key: this.transformExpression(v), value: PerlLiteral.Number(1) }));
            return new PerlHash(pairs);
          }
          return new PerlHash([]);
        }

        case 'ArrayFind': {
          // array.find(fn) -> List::Util::first { $_ matches condition } @arr
          const findArr = this.transformExpression(node.array);
          const callbackBlock = this.transformListUtilCallback(node.callback);
          this.addRequiredModule('List::Util', 'first');
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("first"), "::"), [
            callbackBlock,
            this.wrapArrayDeref(findArr)
          ]);
        }

        case 'ArrayFindIndex': {
          // Similar to indexOf but with callback - use firstidx from List::MoreUtils
          this.addRequiredModule('List::MoreUtils', 'firstidx');
          const findIdxArr = this.transformExpression(node.array);
          const findIdxBlock = this.transformListUtilCallback(node.callback);
          return new PerlCall('firstidx', [
            findIdxBlock,
            this.wrapArrayDeref(findIdxArr)
          ]);
        }

        case 'ArrayEvery': {
          // array.every((val, idx) => ...) - a 2nd (index) callback param
          // can't be served by List::Util::all's $_-only block form (see
          // transformListUtilCallback/_transformIndexedEverySome's doc
          // comment) - e.g. asymmetric/ml-dsa.js's NIST-test-vector-seed
          // check "seed.every((val, idx) => val === expected[idx])".
          if (node.callback?.params?.length > 1)
            return this._transformIndexedEverySome(node.array, node.callback, true);
          // array.every(fn) -> List::Util::all { $_ matches condition } @arr
          const everyArr = this.transformExpression(node.array);
          const everyBlock = this.transformListUtilCallback(node.callback);
          this.addRequiredModule('List::Util', 'all');
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("all"), "::"), [
            everyBlock,
            this.wrapArrayDeref(everyArr)
          ]);
        }

        case 'ArraySome': {
          // See ArrayEvery's 2-param-callback comment just above.
          if (node.callback?.params?.length > 1)
            return this._transformIndexedEverySome(node.array, node.callback, false);
          // array.some(fn) -> List::Util::any { $_ matches condition } @arr
          const someArr = this.transformExpression(node.array);
          // Debug: log callback structure
          if (this.options.debug) console.log('ArraySome callback:', JSON.stringify(node.callback, null, 2).substring(0, 500));
          const someBlock = this.transformListUtilCallback(node.callback);
          this.addRequiredModule('List::Util', 'any');
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("any"), "::"), [
            someBlock,
            this.wrapArrayDeref(someArr)
          ]);
        }

        // MathCall - for unhandled Math.* methods
        case 'MathCall': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          switch (node.method) {
            case 'imul':
              // Math.imul(a, b) is JS's exact (non-precision-losing) 32-bit
              // multiply - round-trip through a 32-bit pack/unpack (rather
              // than Perl's native "*", which computes the mathematically
              // *exact*, wider-than-32-bit product with no truncation at
              // all) to get only the low 32 bits of the true product.
              //
              // Both operands are masked to unsigned 32-bit *first*: either
              // can carry "garbage" high bits above bit 31 - e.g. a prior
              // "h1 ^ k1" where k1 came from another such 32-bit multiply
              // (native Perl "^"/"+"/etc. sign-extend a negative operand
              // across its full 64-bit width, not just 32 bits) that a
              // later step never had reason to re-mask before reaching this
              // multiply. (a mod 2**32) * (b mod 2**32) is always ≡ a*b
              // (mod 2**32) regardless of what garbage bits a/b carry above
              // bit 31, so masking first is always safe; *not* masking let
              // those garbage high bits multiply through into the
              // product's low 32 bits (real multiplication mixes bits
              // across positions via carries, unlike XOR/shift) - and,
              // separately, the "garbage" value can be astronomically
              // large (a negative small int's full 64-bit two's-complement
              // pattern), pushing the exact product beyond Perl's 64-bit
              // integer range into silent float-promotion territory.
              //
              // The *result* is unpacked as unsigned ('L', not 'l'): every
              // other 32-bit word elsewhere in this codebase's Perl output
              // is represented as the unsigned 0..2**32-1 form (that's what
              // the ubiquitous "& 0xFFFFFFFF" masking idiom produces) - a
              // signed result here would be the one place breaking that
              // convention, and was exactly the bug: a *negative* Perl
              // scalar reaching a later "+"/"^"/etc. (all of which treat a
              // negative operand as its full 64-bit two's-complement
              // pattern, not a 32-bit one) reintroduces the identical
              // garbage-high-bits problem this comment already describes
              // for the *input* side - e.g. random/splitmix32.js's/
              // xoshiro-plusplus.js's Weyl-sequence "state = OpCodes.ToInt(
              // state + GOLDEN_GAMMA)" accumulator (see the Cast/'int' case
              // above) went negative and every subsequent addition of
              // GOLDEN_GAMMA to it silently accumulated 64-bit-wide sign-
              // extension garbage instead of wrapping cleanly at 32 bits.
              // The bit pattern is identical either way (pack('l',X) and
              // pack('L',X) produce the same bytes for the same integer X
              // mod 2**32) - only the sign of the *decoded* Perl scalar
              // differs, so this changes no numeric (mod 2**32) result,
              // only which representation propagates forward safely.
              if (args.length >= 2)
                return new PerlRawCode(`unpack('L', pack('l', (${args[0]} & 0xFFFFFFFF) * (${args[1]} & 0xFFFFFFFF)))`);
              break;
            case 'abs':
              return new PerlCall('abs', args);
            case 'floor':
              this.addRequiredModule('POSIX');
              return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("floor"), "::"), args);
            case 'ceil':
              this.addRequiredModule('POSIX');
              return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("ceil"), "::"), args);
            case 'round':
              this.addRequiredModule('POSIX');
              return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("round"), "::"), args);
            case 'min':
              this.addRequiredModule('List::Util', 'min');
              return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("min"), "::"), args);
            case 'max':
              this.addRequiredModule('List::Util', 'max');
              return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("max"), "::"), args);
            case 'pow':
              return new PerlBinaryExpression(args[0], '**', args[1]);
            case 'sqrt':
              return new PerlCall('sqrt', args);
            case 'log':
              return new PerlCall('log', args);
            case 'exp':
              return new PerlCall('exp', args);
            case 'sin':
              return new PerlCall('sin', args);
            case 'cos':
              return new PerlCall('cos', args);
            case 'random':
              return new PerlCall('rand', []);
            case 'trunc':
              return new PerlCall('int', args);
            case 'sign':
              // sign(x) = x > 0 ? 1 : (x < 0 ? -1 : 0)
              // Perl: ($x <=> 0)
              return new PerlBinaryExpression(args[0], '<=>', PerlLiteral.Number(0));
            case 'tan':
              return new PerlBinaryExpression(new PerlCall('sin', args), '/', new PerlCall('cos', args));
            case 'asin':
              return new PerlCall('atan2', [args[0], new PerlCall('sqrt', [new PerlBinaryExpression(PerlLiteral.Number(1), '-', new PerlBinaryExpression(args[0], '*', args[0]))])]);
            case 'acos':
              return new PerlCall('atan2', [new PerlCall('sqrt', [new PerlBinaryExpression(PerlLiteral.Number(1), '-', new PerlBinaryExpression(args[0], '*', args[0]))]), args[0]]);
            case 'atan':
              return new PerlCall('atan2', [args[0], PerlLiteral.Number(1)]);
            case 'atan2':
              return new PerlCall('atan2', args);
            case 'sinh':
              this.addRequiredModule('POSIX');
              return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("sinh"), "::"), args);
            case 'cosh':
              this.addRequiredModule('POSIX');
              return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("cosh"), "::"), args);
            case 'tanh':
              this.addRequiredModule('POSIX');
              return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("tanh"), "::"), args);
            case 'cbrt':
              return new PerlBinaryExpression(args[0], '**', new PerlGrouped(new PerlBinaryExpression(PerlLiteral.Number(1), '/', PerlLiteral.Number(3))));
            case 'hypot':
              return new PerlCall('sqrt', [new PerlBinaryExpression(new PerlBinaryExpression(args[0], '*', args[0]), '+', new PerlBinaryExpression(args[1], '*', args[1]))]);
            case 'fround':
              return args[0];
            case 'log2':
              return new PerlBinaryExpression(new PerlCall('log', args), '/', new PerlCall('log', [PerlLiteral.Number(2)]));
            case 'log10':
              return new PerlBinaryExpression(new PerlCall('log', args), '/', new PerlCall('log', [PerlLiteral.Number(10)]));
            default:
              // Fallback to lowercase function name
              return new PerlCall(node.method.toLowerCase(), args);
          }
        }

        // ========================[ String IL Node Types ]========================

        case 'StringReplace': {
          // string.replace(search, replacement) -> s/search/replacement/r
          // For simple cases, use: ($str =~ s/search/replacement/r).
          // Reads the IL node's actual field names (searchValue/replaceValue
          // - see type-aware-transpiler.js's 'replace'/'replaceAll' case);
          // this previously read node.search/node.pattern/node.replacement,
          // none of which the IL node actually sets, so both always fell
          // back to '' and every .replace() call silently became a no-op.
          const str = this.transformExpression(node.string || node.object);
          const searchNode = node.searchValue || node.search || node.pattern;
          // A JS regex literal (e.g. /[^A-Z]/g) parses to a Literal node
          // carrying its pattern/flags in a `.regex` sub-object, not a
          // string in `.value` - transformExpression()'ing it as a generic
          // expression and \Q\E-escaping the result would both use the
          // wrong (placeholder) value and defeat the regex if it somehow
          // didn't. Read the pattern/flags directly for a regex argument;
          // only \Q\E-escape (literal-match) an actual string argument.
          const isRegexArg = !!(searchNode && searchNode.regex);
          let pattern, baseFlags;
          // A non-simple search expression (e.g. "cleanKey[i]", a computed
          // string-index access - see classical/phillips.js's key-square
          // construction) transforms to a PerlNode with no working
          // toString() (only a handful of "operand-shaped" node classes
          // define one - see PerlConditional's toString() doc comment, and
          // "str"'s identical concern a few lines below) - the naive
          // "`\\Q${search}\\E`" template interpolation just below silently
          // splices in either "[object Object]" or, worse here, an entire
          // *literal-Perl-source-code-shaped string* (a PerlRawCode's
          // .toString() returns its actual code text, e.g. the out-of-
          // range-safe "do { my $_idx = ...; ... }" this codebase's
          // str[i]-bracket-indexing fix now produces), which \Q\E then
          // quotes as inert literal TEXT instead of ever evaluating it -
          // "$_idx"/"$_str" inside that quoted text aren't real
          // declarations at all from Perl's point of view, dying "Global
          // symbol "$_idx" requires explicit package name". Bind any
          // non-simple search expression to its own temp variable (via a
          // real do-block declaration, collected into searchPreDecl and
          // spliced into whichever block gets built below) exactly the way
          // "str" already is, and reference only that guaranteed-simple
          // temp variable inside the \Q...\E pattern.
          let searchPreDecl = null;
          if (isRegexArg) {
            pattern = searchNode.regex.pattern;
            baseFlags = (searchNode.regex.flags || '').replace(/[^gimsx]/g, '');
          } else {
            const searchExprNode = this.transformExpression(searchNode) || PerlLiteral.String('', "'");
            const searchIsSimple = searchExprNode.nodeType === 'Identifier' || searchExprNode.nodeType === 'Literal' || searchExprNode.nodeType === 'Grouped';
            let searchRef = searchExprNode;
            if (!searchIsSimple) {
              const searchTmpName = `_ta_search${this._typedArraySrcCounter = (this._typedArraySrcCounter || 0) + 1}`;
              searchPreDecl = new PerlVarDeclaration('my', searchTmpName, '$', searchExprNode);
              searchRef = new PerlIdentifier(searchTmpName, '$');
            }
            pattern = `\\Q${searchRef}\\E`;
            baseFlags = '';
          }
          // JS .replaceAll() always replaces every match (a non-global regex
          // argument is actually a TypeError in real JS, but bundled code
          // doesn't validate that here) - .replace() only replaces the
          // first match unless the regex itself carries /g.
          if (node.method === 'replaceAll' && !baseFlags.includes('g')) baseFlags += 'g';
          const replacementNode = node.replaceValue || node.replacement;
          // The replacement slot of s/.../.../ is interpolated (double-quote-
          // like) text, not a Perl expression - a plain string literal
          // replacement (overwhelmingly the common case: "").replace(x, '')")
          // must be spliced in as its raw characters (escaping the handful
          // that are special in that interpolated context: \, $, @), not as
          // `${replacement}`'s PerlLiteral.toString() (which wraps it in
          // Perl *quote* characters, e.g. an empty-string replacement
          // rendered as the two literal characters "''" - replacing every
          // match with a pair of apostrophes instead of deleting it).
          const replacementLiteralValue = replacementNode && replacementNode.type === 'Literal' &&
            typeof replacementNode.value === 'string' ? replacementNode.value : null;
          const replacement = replacementLiteralValue !== null
            ? replacementLiteralValue.replace(/[\\$@]/g, '\\$&')
            : (this.transformExpression(replacementNode) || PerlLiteral.String('', "'"));
          // "str" is only guaranteed to stringify correctly via the naive
          // `${str}` template interpolation below when it's a simple
          // PerlLiteral/PerlIdentifier (both define toString()) - anything
          // more complex (e.g. the receiver of a chained call like
          // "inputString.toUpperCase().replace(...)", itself a PerlCall/
          // PerlMemberAccess node with no generic toString()) silently
          // renders as the literal text "[object Object]" (a hard Perl
          // parse error right before "=~"). Bind it to a temp variable
          // through a real AST do-block first (built the same way
          // TypedArrayCreation's copy-vs-zero-fill disambiguation is,
          // above) so the emitter's normal recursive emit() renders it
          // correctly regardless of complexity, then reference just that
          // temp variable (guaranteed to stringify fine) in the RawCode.
          // A JS regex pattern containing a literal (unescaped, since valid
          // in a JS /.../ regex literal) "/" - e.g. encoding/morse.js's
          // "/[^.\-\s/]/g" - breaks Perl's naive delimiter matching when
          // spliced into a "/"-delimited s/PATTERN/REPLACEMENT/ (the
          // in-pattern "/" is read as the delimiter closing the PATTERN
          // slot early, corrupting the whole substitution and usually
          // dying "Unmatched [ in regex"). Use Perl's bracket-delimiter
          // form (s{PATTERN}{REPLACEMENT}) instead whenever that happens -
          // Perl correctly nest-counts balanced "{"/"}" within a bracket-
          // delimited pattern too (e.g. a "{2,3}" quantifier), so this is
          // safe even when the pattern also contains literal braces.
          // A literal (unescaped) "/" in the REPLACEMENT text breaks the
          // same way (e.g. encoding/morse.js's ".replace(/\s*\/\s*/g, ' / ')"
          // - pattern's own "/" IS already escaped as "\/" so useBraceDelim
          // alone stayed false, but the replacement string " / " contains
          // an unescaped "/" that terminates the REPLACEMENT slot early
          // instead of the whole s/.../.../ construct, corrupting the flags
          // that follow ("Bareword ... not allowed" from the leftover "gr"
          // text). Only checked for a plain string-literal replacement
          // (replacementLiteralValue) - the only case where "replacement"
          // is raw interpolated text rather than a PerlNode.
          const replacementHasSlash = replacementLiteralValue !== null && replacementLiteralValue.includes('/');
          const useBraceDelim = /(?<!\\)\//.test(pattern) || replacementHasSlash;
          // Single-char delimiter style reuses one character 3 times
          // (s/PATTERN/REPLACEMENT/); bracket style needs 2 separate
          // "{...}" pairs (s{PATTERN}{REPLACEMENT}) - open/mid/close differ
          // per style, not just a single open/close pair.
          const open = useBraceDelim ? '{' : '/';
          const mid = useBraceDelim ? '}{' : '/';
          const close = useBraceDelim ? '}' : '/';
          const strIsSimple = str.nodeType === 'Identifier' || str.nodeType === 'Literal' || str.nodeType === 'Grouped';
          if (strIsSimple && !searchPreDecl) {
            return new PerlRawCode(`(${str} =~ s${open}${pattern}${mid}${replacement}${close}${baseFlags}r)`);
          }
          const stmts = [];
          if (searchPreDecl) stmts.push(searchPreDecl);
          let strRef = str;
          if (!strIsSimple) {
            const tmpName = `_ta_str${this._typedArraySrcCounter = (this._typedArraySrcCounter || 0) + 1}`;
            stmts.push(new PerlVarDeclaration('my', tmpName, '$', str));
            strRef = new PerlIdentifier(tmpName, '$');
          }
          stmts.push(new PerlExpressionStatement(new PerlRawCode(`(${strRef} =~ s${open}${pattern}${mid}${replacement}${close}${baseFlags}r)`)));
          const block = new PerlBlock(stmts);
          return new PerlGrouped(new PerlCall('do', [block]));
        }

        case 'StringRepeat': {
          // string.repeat(count) -> $str x $count
          const str = this.transformExpression(node.string || node.object);
          const count = this.transformExpression(node.count);
          return new PerlBinaryExpression(str, 'x', count);
        }

        case 'StringIndexOf': {
          // string.indexOf(search, start?) -> index($str, $search, $start?)
          const str = this.transformExpression(node.string || node.object);
          const search = this.transformExpression(node.searchValue || node.search);
          const args = [str, search];
          if (node.start || node.fromIndex) args.push(this.transformExpression(node.start || node.fromIndex));
          return new PerlCall('index', args);
        }

        case 'StringSplit': {
          // string.split(separator) -> split(/$sep/, $str)
          const str = this.transformExpression(node.string || node.object);
          let sep = node.separator ? this.transformExpression(node.separator) : PerlLiteral.String('', "'");
          // A plain (non-regex) string separator must be escaped before use
          // as Perl's split() pattern - see the identical fix (and its full
          // doc comment) in transformCallExpression's method === 'split'
          // case just below; this IL 'StringSplit' node is the path this
          // codebase's parser actually lowers a plain ".split(x)" call
          // into (the CallExpression case only ever sees a handful of
          // shapes the IL builder didn't already claim), so that other fix
          // alone never took effect for e.g. classical/jefferson-wheel.js's
          // "keyString.split('|')" (died "Argument "|" isn't numeric in
          // int", since split('|', ...) - a bare regex alternation of two
          // empty patterns - split every character instead of on the
          // literal pipe).
          const origSep = node.separator;
          if (origSep && origSep.type === 'Literal' && !origSep.regex && typeof origSep.value === 'string') {
            const escaped = origSep.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            sep = new PerlRegex(escaped, '');
          }
          return new PerlArray([new PerlCall('split', [sep, str])]);
        }

        case 'StringSubstring': {
          // string.substring(start, end?) -> substr($str, $start, $end - $start)
          // string.substr(start, length?) -> substr($str, $start, $length) -
          // substr()'s 2nd arg is already a character count, unlike
          // substring()'s end index (see the length/end split in
          // type-aware-transpiler.js's StringSubstring IL node).
          const str = this.transformExpression(node.string || node.object);
          const start = node.start ? this.transformExpression(node.start) : PerlLiteral.Number(0);
          const args = [str, start];
          if (node.length) {
            args.push(this.transformExpression(node.length));
          } else if (node.end) {
            const end = this.transformExpression(node.end);
            // length = end - start
            args.push(new PerlBinaryExpression(end, '-', start));
          }
          return new PerlCall('substr', args);
        }

        case 'StringCharAt': {
          // string.charAt(index) -> substr($str, $index, 1)
          const str = this.transformExpression(node.string || node.object);
          const index = this.transformExpression(node.index);
          return new PerlCall('substr', [str, index, PerlLiteral.Number(1)]);
        }

        case 'StringCharCodeAt': {
          // string.charCodeAt(index) -> ord(substr($str, $index, 1))
          const str = this.transformExpression(node.string || node.object);
          const index = this.transformExpression(node.index);
          return new PerlCall('ord', [
            new PerlCall('substr', [str, index, PerlLiteral.Number(1)])
          ]);
        }

        case 'StringToUpperCase': {
          // string.toUpperCase() -> uc($str)
          const str = this.transformExpression(node.string || node.object || node.argument);
          return new PerlCall('uc', [str]);
        }

        case 'StringTransform': {
          // Generic string transformation node with method property
          const str = this.transformExpression(node.string || node.object || node.argument);
          const method = node.method;

          switch (method) {
            case 'toLowerCase':
              return new PerlCall('lc', [str]);
            case 'toUpperCase':
              return new PerlCall('uc', [str]);
            case 'trim':
              // str is already a PerlAST node, wrap in do block for regex
              return new PerlRawCode(`do { my $_tmp_str = ${str}; $_tmp_str =~ s/^\\s+|\\s+$//g; $_tmp_str; }`);
            case 'trimStart':
            case 'trimLeft':
              return new PerlRawCode(`do { my $_tmp_str = ${str}; $_tmp_str =~ s/^\\s+//; $_tmp_str; }`);
            case 'trimEnd':
            case 'trimRight':
              return new PerlRawCode(`do { my $_tmp_str = ${str}; $_tmp_str =~ s/\\s+$//; $_tmp_str; }`);
            default:
              // Fallback: just return the string
              return str;
          }
        }

        case 'StringToLowerCase': {
          // string.toLowerCase() -> lc($str)
          const str = this.transformExpression(node.string || node.object || node.argument);
          return new PerlCall('lc', [str]);
        }

        case 'StringTrim': {
          // string.trim() -> $str =~ s/^\s+|\s+$//gr
          const str = this.transformExpression(node.string || node.object || node.argument);
          return new PerlRawCode(`(${str} =~ s/^\\s+|\\s+$//gr)`);
        }

        case 'StringStartsWith': {
          // string.startsWith(prefix) -> substr($str, 0, length($prefix)) eq $prefix
          const str = this.transformExpression(node.string || node.object);
          const prefix = this.transformExpression(node.prefix || node.search);
          return new PerlBinaryExpression(
            new PerlCall('substr', [str, PerlLiteral.Number(0), new PerlCall('length', [prefix])]),
            'eq',
            prefix
          );
        }

        case 'StringEndsWith': {
          // string.endsWith(suffix) -> substr($str, -length($suffix)) eq $suffix
          const str = this.transformExpression(node.string || node.object);
          const suffix = this.transformExpression(node.suffix || node.search);
          return new PerlBinaryExpression(
            new PerlCall('substr', [str, new PerlUnaryExpression('-', new PerlCall('length', [suffix]))]),
            'eq',
            suffix
          );
        }

        case 'StringIncludes': {
          // string.includes(search) -> index($str, $search) >= 0
          // Note: The IL uses 'method' to distinguish includes/startsWith/endsWith
          const str = this.transformExpression(node.string || node.object);
          const search = this.transformExpression(node.searchValue || node.search);

          // Handle the method property if present (includes, startsWith, endsWith)
          if (node.method === 'startsWith') {
            return new PerlBinaryExpression(
              new PerlCall('substr', [str, PerlLiteral.Number(0), new PerlCall('length', [search])]),
              'eq',
              search
            );
          }
          if (node.method === 'endsWith') {
            return new PerlBinaryExpression(
              new PerlCall('substr', [str, new PerlUnaryExpression('-', new PerlCall('length', [search]))]),
              'eq',
              search
            );
          }

          // Default: includes - use index >= 0
          return new PerlBinaryExpression(
            new PerlCall('index', [str, search]),
            '>=',
            PerlLiteral.Number(0)
          );
        }

        // ========================[ Additional IL Node Types ]========================

        case 'BigIntCast': {
          // BigInt(value) -> Perl handles arbitrary precision integers natively
          // Just return the value
          const val = this.transformExpression(node.value || node.argument || (node.arguments && node.arguments[0]));
          return val;
        }

        case 'TypedArraySet': {
          // typedArray.set(source, offset?) -> splice(@arr, $offset, scalar(@source), @source)
          const target = this.transformExpression(node.target || node.array);
          const source = this.transformExpression(node.source || node.values);
          const offset = node.offset ? this.transformExpression(node.offset) : PerlLiteral.Number(0);
          return new PerlCall('splice', [
            this.wrapArrayDeref(target),
            offset,
            new PerlCall('scalar', [this.wrapArrayDeref(source)]),
            this.wrapArrayDeref(source)
          ]);
        }

        case 'TypedArraySubarray': {
          // array.subarray(begin, end) -> a *view* aliasing the parent's
          // elements, matching JS semantics: TypedArray.subarray() shares the
          // same underlying buffer as its parent, so writes through the
          // subarray (or through a function parameter it's passed as) must be
          // visible in the parent array. A plain "[@{$array}[begin..end-1]]"
          // copy (this used to build one directly) silently breaks any code
          // that relies on that write-through - e.g. hash/skinny-hash.js's
          // "skinny128_256_encrypt_tk_full(this.state, temp.subarray(16),
          // block)" writes its ciphertext out-parameter element-by-element;
          // with a copy, the second half of "temp" never saw those writes and
          // stayed all-zero, corrupting every hash after the first permute()
          // call. Same pattern in block/crypton.js's key schedule ("dest.set
          // (tmpOut)" where "dest = dKey.subarray(...)").
          //
          // Implemented as a tied array (see PerlEmitter.js's
          // emitSubarrayViewClass / the _JSSubarrayView package): FETCH/STORE
          // index into the parent arrayref at $begin+$idx, so both direct
          // element reads/writes ("$view->[$i]") and whole-array ops that
          // degrade to FETCH/STORE (splice, used by the '.set()'
          // TypedArraySet case above) transparently read/write through to the
          // parent. "do { my @v; tie @v, ...; \@v }" is a normal Perl
          // expression (the last statement in a do-block is its value), so
          // this slots into any expression position (call argument,
          // assignment RHS, ...) exactly like the old array-literal did.
          this.usesSubarrayView = true;
          const array = this.transformExpression(node.array);
          const begin = node.begin ? this.transformExpression(node.begin) : PerlLiteral.Number(0);
          const len = node.end
            ? new PerlBinaryExpression(this.transformExpression(node.end), '-', begin)
            : new PerlBinaryExpression(new PerlCall('scalar', [this.wrapArrayDeref(array)]), '-', begin);
          const subarrayView = new PerlRawCode(`do { my @__sav; tie @__sav, '_JSSubarrayView', ${array}, ${begin}, ${len}; \\@__sav }`);
          // Tells wrapArrayDeref (see its 'RawCode' case) this evaluates to
          // an arrayref *scalar*, not an already-flattened list - needed so
          // e.g. a subarray used as .set()'s source argument (TypedArraySet
          // above) gets properly "@{...}"-dereferenced into its elements
          // instead of being passed as a single scalar.
          subarrayView.isArrayRefValue = true;
          return subarrayView;
        }

        case 'ArrayReduce': {
          // array.reduce(fn, initial) -> List::Util::reduce { fn } @arr (use fully qualified name for cross-package use)
          const reduceArr = this.transformExpression(node.array);
          const callback = this.transformExpression(node.callback);
          const args = [callback, this.wrapArrayDeref(reduceArr)];
          this.addRequiredModule('List::Util', 'reduce');
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("reduce"), "::"), args);
        }

        // IL AST StringInterpolation - `Hello ${name}` -> "Hello $name"
        case 'StringInterpolation': {
          // Build parts array for PerlStringInterpolation (handles emission properly)
          const parts = [];
          if (node.parts) {
            for (const part of node.parts) {
              if (part.type === 'StringPart' || part.ilNodeType === 'StringPart') {
                if (part.value) parts.push(part.value);
              } else if (part.type === 'ExpressionPart' || part.ilNodeType === 'ExpressionPart') {
                const expr = this.transformExpression(part.expression);
                if (expr) parts.push(expr);
              }
            }
          } else if (node.quasis && node.expressions) {
            for (let i = 0; i < node.quasis.length; ++i) {
              if (node.quasis[i]) parts.push(node.quasis[i]);
              if (i < node.expressions.length) {
                const expr = this.transformExpression(node.expressions[i]);
                if (expr) parts.push(expr);
              }
            }
          }
          return new PerlStringInterpolation(parts);
        }

        // IL AST ObjectLiteral - {key: value} -> {key => value}
        case 'ObjectLiteral': {
          if (!node.properties || node.properties.length === 0)
            return new PerlHash([]);

          // Pre-group get/set accessor properties (kind: 'get'/'set') by key
          // name - a legacy "const X = { ..., set key(v) {...}, get key() {...},
          // ... }" algorithm-object literal (see e.g. "set key(keyBytes)" /
          // "get key()" in algorithms/block/deal.js's CreateInstance()
          // factory) produces TWO separate properties sharing the same key.
          // Handling them like any other property below (one pairs entry
          // each) silently corrupted every such accessor: Perl hash literals
          // keep only the LAST duplicate key, so whichever of the getter/
          // setter coderefs was written later in the source permanently won -
          // the harness's "$inst->key($keyBytes)" call (routed through
          // _LegacyAlgoObj's AUTOLOAD, see PerlEmitter.js) then either always
          // invoked the getter (ignoring the assigned value, so
          // this.KeySetup(...) never ran - "Key not set"/"Not initialized")
          // or always invoked the setter (so plain reads silently re-ran
          // setup logic). Instead, merge each such pair into ONE coderef that
          // branches on argument count at call time - see
          // transformObjectAccessorPair, mirroring how transformAccessorPair
          // already does this for class-based get/set pairs.
          const accessorGroups = new Map(); // key -> {get: prop|null, set: prop|null}
          for (const prop of node.properties) {
            if (prop.type === 'SpreadElement') continue;
            if (prop.kind !== 'get' && prop.kind !== 'set') continue;
            const key = this._normalizeLiteralObjectKey(prop.key?.name || prop.key?.value || prop.key || 'key');
            let group = accessorGroups.get(key);
            if (!group) { group = { get: null, set: null }; accessorGroups.set(key, group); }
            group[prop.kind] = prop;
          }

          const pairs = [];
          let hasFunctionProperty = false;
          const emittedAccessorKeys = new Set();
          for (const prop of node.properties) {
            if (prop.type === 'SpreadElement') continue;
            const key = this._normalizeLiteralObjectKey(prop.key?.name || prop.key?.value || prop.key || 'key');
            if (prop.kind === 'get' || prop.kind === 'set') {
              // Emit the combined accessor coderef once, at the position of
              // whichever of the getter/setter comes first in source order.
              if (emittedAccessorKeys.has(key)) continue;
              emittedAccessorKeys.add(key);
              hasFunctionProperty = true;
              const group = accessorGroups.get(key);
              const combined = this.transformObjectAccessorPair(group.get, group.set);
              pairs.push({ key: PerlLiteral.String(key), value: combined });
              continue;
            }
            const propType = prop.value?.type || prop.value?.ilNodeType;
            const isFuncProp = propType === 'FunctionExpression' || propType === 'ArrowFunctionExpression' || propType === 'ArrowFunction';
            if (isFuncProp) hasFunctionProperty = true;
            // Force every direct method-value function of this object
            // literal to always declare $self first - see the forceSelf
            // comment in transformFunctionExpression for why (every internal
            // call is written "this.foo(...)" and thus always transpiles to
            // a "$self->foo(...)" AUTOLOAD-dispatched call that always
            // passes $self as the first argument, whether or not foo's body
            // itself references 'this').
            if (isFuncProp) this._forceSelfParam = true;
            const value = this.transformExpression(prop.value);
            pairs.push({
              key: PerlLiteral.String(key),
              value: value || PerlLiteral.Undef()
            });
          }
          const hash = new PerlHash(pairs);
          // Legacy "const X = { name: ..., CreateInstance: function(){...}, ... }"
          // algorithm-object literals (as opposed to plain data objects like
          // test vectors) carry at least one method as a function-valued
          // property - bless the hashref into _LegacyAlgoObj so "$x->Method(...)"
          // call syntax dispatches to that coderef instead of dying with
          // "Can't call method ... on unblessed reference" (see the mirrored
          // check in the (legacy, non-IL) transformObjectExpression, and
          // module.usesLegacyAlgoObj / PerlEmitter's _LegacyAlgoObj stub).
          if (hasFunctionProperty) {
            this.usesLegacyAlgoObj = true;
            return new PerlBless(hash, '_LegacyAlgoObj');
          }
          return hash;
        }

        // IL AST StringFromCharCodes - String.fromCharCode(65) -> chr(65)
        case 'StringFromCharCodes': {
          // The IL node stores its operands under "charCodes", not
          // "arguments" (see TypeAwareJSASTParser) - reading "arguments"
          // here always yielded an empty list, silently turning every
          // String.fromCharCode(...) call into an empty string literal.
          const rawCharCodes = node.charCodes || node.arguments || [];
          // String.fromCharCode(...bytes) - a spread of a whole byte array
          // (this codebase's dominant "uint8[] -> string" idiom) parses as
          // a single-element charCodes list whose one element is a
          // SpreadElement, not one-argument-per-char. chr() has a
          // scalar-only ($) Perl prototype, so it can't take the
          // dereferenced list directly (unlike an ordinary sub) - needs the
          // same join/map-over-each-byte treatment as the true multi-arg
          // case below, over @{$data} instead of a literal arg list.
          if (rawCharCodes.length === 1 && rawCharCodes[0].type === 'SpreadElement') {
            const arr = this.transformExpression(rawCharCodes[0].argument);
            return new PerlCall('join', [
              PerlLiteral.String('', "'"),
              new PerlCall('map', [
                new PerlRawCode('{ chr($_) }'),
                new PerlUnaryExpression('@', arr, true)
              ])
            ]);
          }
          const args = rawCharCodes.map(a => this.transformExpression(a));
          if (args.length === 0)
            return PerlLiteral.String('', "'");
          if (args.length === 1)
            return new PerlCall('chr', args);
          // Multiple chars: join('', map { chr($_) } (c1, c2, ...))
          return new PerlCall('join', [
            PerlLiteral.String('', "'"),
            new PerlCall('map', [
              new PerlRawCode('{ chr($_) }'),
              new PerlList(args)
            ])
          ]);
        }

        // IL AST IsArrayCheck - Array.isArray(x) -> ref($x) eq 'ARRAY'
        case 'IsArrayCheck': {
          const value = this.transformExpression(node.value);
          return new PerlBinaryExpression(
            new PerlCall('ref', [value]),
            'eq',
            PerlLiteral.String('ARRAY', "'")
          );
        }

        // IL AST ArrowFunction - (x) => expr -> sub { my ($x) = @_; expr }
        case 'ArrowFunction': {
          // Map parameters to Perl parameter nodes
          const params = (node.params || []).map(p => {
            const name = typeof p === 'string' ? p : (p.name || 'arg');
            return new PerlParameter(name, '$');
          });

          // Transform body to a PerlBlock
          let body = null;
          if (node.body) {
            if (node.body.type === 'BlockStatement') {
              // Block body: transform all statements
              body = this.transformBlockStatement(node.body);
            } else {
              // Expression body: wrap in a return statement
              const expr = this.transformExpression(node.body);
              body = new PerlBlock([new PerlReturn(expr)]);
            }
          } else {
            body = new PerlBlock([]);
          }

          return new PerlAnonSub(params, body);
        }

        // IL AST TypeOfExpression - typeof x -> ref($x) || 'SCALAR'.
        // Only reached when typeof isn't directly compared to a literal
        // (that's handled, with a vocabulary that actually matches JS's
        // typeof strings, by transformBinaryExpression's
        // _matchTypeofStringLiteral special case above) - e.g. typeof used
        // standalone or assigned to a variable. The IL node carries its
        // operand as `.argument` (see type-aware-transpiler.js's "op ===
        // 'typeof'" case), not `.value` - reading the wrong property here
        // silently produced a bare, argument-less "ref()" call (which
        // checks Perl's implicit $_ instead of the actual operand).
        case 'TypeOfExpression': {
          const arg = node.argument || node.value;
          // "typeof require" (Node/CommonJS-only global, doesn't exist in
          // Perl) - most "typeof require !== 'undefined'" module-loader
          // guards are stripped away entirely before reaching here (see
          // type-aware-transpiler.js's _stripRequireGuardedBlocks), but a
          // few survive inside a method body rather than the top-level UMD
          // wrapper (e.g. stream/xchacha20.js's generateNonce()'s Node
          // crypto.randomBytes fallback). Falling through to the generic
          // "ref($x) || 'SCALAR'" lowering below read an undeclared bare
          // "$require" ("Global symbol $require requires explicit package
          // name"). Resolving to always-'undefined' correctly skips that
          // Node-only branch - the right outcome for deterministic
          // test-vector execution anyway (mirrors transformUnaryExpression's
          // identical jsGlobals handling for the sibling raw-UnaryExpression
          // "typeof" shape this IL node normally supersedes).
          if (arg && arg.type === 'Identifier' && arg.name === 'require')
            return PerlLiteral.String('undefined', "'");
          const value = this.transformExpression(arg);
          return new PerlBinaryExpression(
            new PerlCall('ref', [value]),
            '||',
            PerlLiteral.String('SCALAR', "'")
          );
        }

        // IL AST ObjectFreeze - Object.freeze(x) -> just return x (no-op in Perl)
        // The IL node carries the argument as `object`, not `value`.
        case 'ObjectFreeze': {
          return this.transformExpression(node.object);
        }

        // IL AST ObjectMerge - Object.assign(target, ...sources): the IL
        // pass lowers Object.assign(...) calls to this dedicated node
        // (carrying `.target`/`.sources`, not a plain CallExpression
        // argument list) - entirely unhandled here previously, so it fell
        // through this whole switch's default straight to a bare "null"
        // literal (e.g. classical/pigpen.js's "this.currentMapping =
        // Object.assign({}, this.standardMapping);" - a clone-and-extend
        // pattern for building a mapping variant off a shared base -
        // transpiled to the flatly-invalid Perl "$self->{currentMapping} =
        // ;"). Shallow-copies target, then merges each source's own keys
        // over it in order (last source wins on collision, matching JS),
        // returning the merged hashref - target itself is never mutated
        // (matching Object.assign({}, ...) - the overwhelmingly common
        // shape in this codebase - and harmless even for the rarer
        // Object.assign(this.field, ...) in-place-merge shape, since the
        // result is always reassigned back onto the same field anyway).
        case 'ObjectMerge': {
          const target = this.transformExpression(node.target);
          const sources = (node.sources || []).map(s => this.transformExpression(s));
          const n = (this._objectMergeCounter = (this._objectMergeCounter || 0) + 1);
          const srcName = `_om_src${n}`;
          const tmpName = `_om_t${n}`;
          const srcIdent = new PerlIdentifier(srcName, '$');
          const tmpIdent = new PerlIdentifier(tmpName, '$');
          // Assign target to a plain scalar variable FIRST, then build the
          // shallow-copy hashref by dereferencing that variable ("{%{$var}}")
          // rather than target's own generated text directly ("{%{TARGET}}").
          // A leading "{" at the start of an expression is genuinely
          // ambiguous in Perl between a hash constructor and a bare block;
          // for the overwhelmingly common "Object.assign({}, ...)" clone-a-
          // blank-object idiom, target's own generated text IS a literal
          // "{}", producing "{%{{}}}" - Perl's parser guesses "block" for
          // the INNER "{}" here (even with a "+{" prefix forcing the OUTER
          // brace to a hash constructor), corrupting not just this specific
          // declaration but every subsequent statement in the enclosing sub
          // too ("Global symbol $_om_tN requires explicit package name"/
          // "Unmatched right curly bracket" cascade, parser resynchronizing
          // at the wrong brace). Routing target through a plain-Identifier
          // intermediate variable sidesteps the ambiguity entirely, since
          // "{%{$_om_srcN}}" never has two braces adjacent.
          const stmts = [
            new PerlVarDeclaration('my', srcName, '$', target),
            new PerlVarDeclaration('my', tmpName, '$', new PerlRawCode(`{%{${srcIdent}}}`))
          ];
          for (const src of sources)
            stmts.push(new PerlExpressionStatement(new PerlRawCode(`@{${tmpIdent}}{keys %{${src}}} = values %{${src}}`)));
          stmts.push(new PerlExpressionStatement(tmpIdent));
          return new PerlCall('do', [new PerlBlock(stmts)]);
        }

        // IL AST ArrayFrom - Array.from(x) -> [ @{$x} ]
        case 'ArrayFrom': {
          // Array.from({ length: N }, mapFn) - N-element array built purely
          // from the callback, with no real array/iterable behind the first
          // argument. Loop 0..N-1 calling mapFn(undef, $i) each time, rather
          // than treating the { length: N } descriptor as something to
          // dereference as an array (see type-aware-transpiler.js ArrayFrom).
          if (node.length) {
            const lengthExpr = this.transformExpression(node.length);
            const mf = node.mapFunction;
            const resultVar = '_afromlen_result_' + (this._aFromCounter || 0);
            this._aFromCounter = (this._aFromCounter || 0) + 1;
            const indexName = (mf && (mf.type === 'ArrowFunctionExpression' || mf.type === 'FunctionExpression' || mf.type === 'ArrowFunction'))
              ? (mf.params?.[1]?.name || '_afromlen_i')
              : '_afromlen_i';
            this.registerVariableType(indexName, '$');

            let bodyExpr;
            if (mf && mf.body && mf.body.type === 'BlockStatement') {
              const bodyStmts = mf.body.body.map(s => this.transformStatement(s));
              bodyExpr = bodyStmts.length > 0 ? bodyStmts[bodyStmts.length - 1] : new PerlIdentifier('undef');
              bodyExpr = bodyExpr.expression || bodyExpr;
            } else if (mf && mf.body) {
              bodyExpr = this.transformExpression(mf.body);
            } else {
              bodyExpr = new PerlIdentifier('undef');
            }

            const loopBody = new PerlBlock([
              new PerlCall('push', [new PerlIdentifier(resultVar, '@'), bodyExpr])
            ]);
            const forLoop = new PerlFor();
            forLoop.isCStyle = true;
            forLoop.init = new PerlVarDeclaration('my', indexName, '$', PerlLiteral.Number(0));
            forLoop.condition = new PerlBinaryExpression(new PerlIdentifier(indexName, '$'), '<', lengthExpr);
            forLoop.increment = new PerlUnaryExpression('++', new PerlIdentifier(indexName, '$'), false);
            forLoop.body = loopBody;

            return new PerlCall('do', [new PerlBlock([
              new PerlVarDeclaration('my', resultVar, '@', null),
              forLoop,
              new PerlUnaryExpression('\\', new PerlIdentifier(resultVar, '@'), true)
            ])]);
          }

          let iterable = this.transformExpression(node.iterable);
          // Array.from(aString) splits into individual characters in JS -
          // a different operation from Array.from(anArrayLike) (shallow
          // copy, just below). Without this, a string iterable (e.g. the
          // encrypt/decrypt-dispatch-ternary result many classical ciphers
          // return - see isStringType's ConditionalExpression/ThisMethodCall
          // resultType checks) was blindly array-dereferenced as-is later
          // via wrapArrayDeref(), dying with "Can't use string ... as an
          // ARRAY ref" (or, worse, silently iterating nothing).
          if (this.isStringType(node.iterable))
            iterable = new PerlArray([new PerlCall('split', [PerlLiteral.String('', "'"), iterable])]);

          // Array.from(aSetVar) (no map function - the common
          // "computeXxx() { ... return Array.from(set).sort(...); }"
          // idiom): a Set is backed by a plain Perl hashref (see
          // setVarNames' doc comment at its call site) whose keys ARE its
          // elements, not an arrayref - "[@{$set}]" (wrapArrayDeref, just
          // below) dies with "Not an ARRAY reference"; "[keys %{$set}]" is
          // the correct shallow copy-to-array. Also covers the "container
          // of Set" shapes (this.field[i], this.field.get(k)) - see
          // _classifyMapSetContainer.
          const iterableIsSet = this._classifyMapSetContainer(node.iterable).isSet;
          if (iterableIsSet && !node.mapFunction) {
            return new PerlArray([new PerlCall('keys', [this.wrapHashDeref(iterable)])]);
          }

          if (node.mapFunction) {
            const mf = node.mapFunction;
            // Inline arrow/function expression bodies to avoid IIFE }( syntax errors
            if (mf.type === 'ArrowFunctionExpression' || mf.type === 'FunctionExpression' || mf.type === 'ArrowFunction') {
              const paramName = mf.params?.[0]?.name;
              const indexName = mf.params?.[1]?.name;
              const useImplicit = !paramName || paramName === '_';

              // If index parameter is used, use for-loop approach (same as transformArrayMap)
              if (indexName) {
                if (paramName && paramName !== '_') this.registerVariableType(paramName, '$');
                this.registerVariableType(indexName, '$');
                const resultVar = '_afrom_result_' + (this._aFromCounter || 0);
                this._aFromCounter = (this._aFromCounter || 0) + 1;

                let bodyExpr;
                if (mf.body && mf.body.type === 'BlockStatement') {
                  const bodyStmts = mf.body.body.map(s => this.transformStatement(s));
                  bodyExpr = bodyStmts.length > 0 ? bodyStmts[bodyStmts.length - 1] : new PerlIdentifier('_', '$');
                } else if (mf.body) {
                  bodyExpr = new PerlExpressionStatement(this.transformExpression(mf.body));
                } else {
                  bodyExpr = new PerlExpressionStatement(new PerlIdentifier('_', '$'));
                }

                const loopBodyStatements = [];
                loopBodyStatements.push(
                  new PerlCall('push', [
                    new PerlIdentifier(resultVar, '@'),
                    bodyExpr.expression || bodyExpr
                  ])
                );
                const loopBody = new PerlBlock(loopBodyStatements);
                const forInit = new PerlVarDeclaration('my', indexName, '$', PerlLiteral.Number(0));
                const forCond = new PerlBinaryExpression(
                  new PerlIdentifier(indexName, '$'),
                  '<',
                  new PerlCall('scalar', [this.wrapArrayDeref(iterable)])
                );
                const forIncr = new PerlUnaryExpression('++', new PerlIdentifier(indexName, '$'), false);
                const forLoop = new PerlFor();
                forLoop.isCStyle = true;
                forLoop.init = forInit;
                forLoop.condition = forCond;
                forLoop.increment = forIncr;
                forLoop.body = loopBody;

                return new PerlCall('do', [new PerlBlock([
                  new PerlVarDeclaration('my', resultVar, '@', null),
                  forLoop,
                  new PerlUnaryExpression('\\', new PerlIdentifier(resultVar, '@'), true)
                ])]);
              }

              let mapBody;
              if (mf.body && mf.body.type === 'BlockStatement') {
                if (!useImplicit) this._listUtilParamReplacement = paramName;
                mapBody = new PerlBlock(
                  mf.body.body.map(s => this.transformStatement(s))
                );
                if (!useImplicit) this._listUtilParamReplacement = null;
              } else if (mf.body) {
                if (!useImplicit) this._listUtilParamReplacement = paramName;
                mapBody = new PerlBlock([
                  new PerlExpressionStatement(this.transformExpression(mf.body))
                ]);
                if (!useImplicit) this._listUtilParamReplacement = null;
              } else {
                mapBody = new PerlBlock([
                  new PerlExpressionStatement(new PerlIdentifier('_', '$'))
                ]);
              }
              return new PerlArray([
                new PerlCall('map', [mapBody, this.wrapArrayDeref(iterable)])
              ]);
            }
            // Named function ref: map { $fn->($_) } @arr
            const mapFn = this.transformExpression(mf);
            const mapBlock = new PerlBlock([
              new PerlExpressionStatement(
                new PerlMemberAccess(mapFn, new PerlCall(null, [new PerlIdentifier('_', '$')]), '->')
              )
            ]);
            return new PerlArray([
              new PerlCall('map', [mapBlock, this.wrapArrayDeref(iterable)])
            ]);
          }
          // [ @{$iterable} ] - create array copy
          return new PerlArray([this.wrapArrayDeref(iterable)]);
        }

        // IL AST ObjectKeys - Object.keys(obj) -> sort { $a <=> $b } keys %{$obj}
        //
        // Sorted numerically rather than the plain unordered "keys
        // %{$obj}" this used to emit: JS guarantees that Object.keys()/
        // values()/entries() visit *integer-index-like* keys (e.g. a
        // byte-frequency table keyed 0..255, as in compression/huffman.js's
        // "Object.keys(frequencies)"/"Object.entries(frequencies)") in
        // ascending numeric order - regardless of insertion order - before
        // any string keys. Perl hashes have no ordering guarantee at all;
        // "keys %hash" order is effectively arbitrary per hash instance.
        // Left uncorrected, that arbitrary order became the effective sort
        // *tie-break* for anything built by sorting these keys/entries
        // afterward (e.g. Huffman/priority-queue construction, which sorts
        // by frequency and relies on JS's stable-sort-over-ascending-
        // insertion-order for equal-frequency symbols) - silently
        // reordering equal-priority symbols and corrupting the output
        // despite the sort itself being logically correct. "$a <=> $b" is
        // a safe default even for non-numeric string keys: Perl's numeric
        // comparison of two non-numeric strings treats both as 0 (always
        // "equal"), so sort's stability just preserves whatever order
        // "keys" produced - no worse than the previous unordered behavior.
        case 'ObjectKeys': {
          const obj = this.transformExpression(node.object);
          // obj is referenced (wrapped) via raw-template interpolation
          // below, which only renders correctly for node types with a
          // real toString() - see 'ObjectEntries' doc comment just below
          // for the getter-backed-property "[object Object]" failure mode
          // this same guard avoids. Bind to a temp var first otherwise.
          const isSimpleExpr = ['Identifier', 'Literal', 'Grouped', 'Subscript'].includes(obj.nodeType) ||
            (obj.nodeType === 'MemberAccess' && typeof obj.member === 'string');
          if (isSimpleExpr) {
            const wrapped = this.wrapHashDeref(obj);
            return new PerlArray([new PerlRawCode(`sort { $a <=> $b } keys ${wrapped}`)]);
          }
          const tmpName = `_ok_obj${this._objectKeysCounter = (this._objectKeysCounter || 0) + 1}`;
          const decl = new PerlVarDeclaration('my', tmpName, '$', obj);
          const tmpRef = new PerlIdentifier(tmpName, '$');
          const wrapped = this.wrapHashDeref(tmpRef);
          // Bracket-wrapped ("[...]") inside the do-block, same as the
          // simple-expr branch's PerlArray - ObjectKeys always returns an
          // arrayref, not a bare list.
          const keysStmt = new PerlExpressionStatement(new PerlRawCode(`[sort { $a <=> $b } keys ${wrapped}]`));
          return new PerlCall('do', [new PerlBlock([decl, keysStmt])]);
        }

        // IL AST ObjectValues - Object.values(obj) -> values in ascending-
        // numeric-key order (see 'ObjectKeys' doc comment just above for
        // why plain "values %{$obj}" - unordered - isn't safe to assume
        // matches JS's Object.values() order).
        case 'ObjectValues': {
          const obj = this.transformExpression(node.object);
          const isSimpleExpr = ['Identifier', 'Literal', 'Grouped', 'Subscript'].includes(obj.nodeType) ||
            (obj.nodeType === 'MemberAccess' && typeof obj.member === 'string');
          if (isSimpleExpr) {
            const wrapped = this.wrapHashDeref(obj);
            return new PerlArray([new PerlRawCode(`map { ${obj}->{$_} } sort { $a <=> $b } keys ${wrapped}`)]);
          }
          const tmpName = `_ov_obj${this._objectValuesCounter = (this._objectValuesCounter || 0) + 1}`;
          const decl = new PerlVarDeclaration('my', tmpName, '$', obj);
          const tmpRef = new PerlIdentifier(tmpName, '$');
          const wrapped = this.wrapHashDeref(tmpRef);
          // Bracket-wrapped, same reasoning as 'ObjectKeys' just above.
          const valuesStmt = new PerlExpressionStatement(new PerlRawCode(`[map { ${tmpRef}->{$_} } sort { $a <=> $b } keys ${wrapped}]`));
          return new PerlCall('do', [new PerlBlock([decl, valuesStmt])]);
        }

        // IL AST ObjectEntries - Object.entries(obj) -> map { [$_, $obj->{$_}] } keys %$obj
        case 'ObjectEntries': {
          let obj = this.transformExpression(node.object);
          // obj is referenced twice below via raw template interpolation,
          // which only renders correctly for AST node types that define a
          // real toString() (Identifier/Literal/Grouped/Subscript/
          // MemberAccess - see the near-identical "strIsSimple" guard at
          // StringReplace's TypedArrayCreation handling above). A getter-
          // backed property access (e.g. classical/al-kindi-frequency.js's
          // "Object.entries(this.ENGLISH_FREQ)", where ENGLISH_FREQ is a
          // `get` accessor routed through the _isAccessorProperty method-
          // call path) transforms to a PerlCall/PerlMemberAccess combo,
          // which has no toString() override - interpolating it directly
          // silently rendered JS's default Object.prototype.toString()
          // text, the literal bareword "[object Object]", into the
          // generated Perl ("$self->[object Object]->{$_}"), which then
          // died at runtime as "Not an ARRAY reference" (Perl parses the
          // bareword "Object" as an indirect-object-style method call).
          // Bind it to a temp var through a real do-block first instead,
          // whose emission goes through the normal recursive emit()
          // (correct regardless of complexity), then reference just that
          // guaranteed-simple temp variable in the raw template below.
          // A MemberAccess node's own toString() is only actually safe when
          // its `.member` is a plain string (e.g. a "Package::CONST"-style
          // reference) - an accessor-property *read* (this.ENGLISH_FREQ,
          // where ENGLISH_FREQ is a getter) transforms to a MemberAccess
          // wrapping a PerlCall (see transformExpression's
          // 'ThisPropertyAccess' case), and PerlCall itself has no
          // toString() override - exactly the unsafe case this whole guard
          // exists for, so it must NOT be treated as simple here.
          const isSimpleExpr = ['Identifier', 'Literal', 'Grouped', 'Subscript'].includes(obj.nodeType) ||
            (obj.nodeType === 'MemberAccess' && typeof obj.member === 'string');
          if (isSimpleExpr) {
            // Create array of [key, value] pairs.
            // NOTE: element access must use the plain reference (->{$_}), not
            // the %{...}-wrapped hash-context form used for `keys` - mixing
            // the two (e.g. %{$obj}->{$_}) is invalid Perl.
            // Sorted numerically ("sort { $a <=> $b } keys" rather than
            // plain "keys") - see 'ObjectKeys' doc comment above for why
            // Perl's unordered "keys %hash" doesn't match JS's guaranteed
            // ascending-integer-key Object.entries() order.
            return new PerlRawCode(`[map { [\$_, ${obj}->{\$_}] } sort { $a <=> $b } keys \%{${obj}}]`);
          }
          const tmpName = `_oe_obj${this._objectEntriesCounter = (this._objectEntriesCounter || 0) + 1}`;
          const decl = new PerlVarDeclaration('my', tmpName, '$', obj);
          const tmpRef = new PerlIdentifier(tmpName, '$');
          const mapStmt = new PerlExpressionStatement(new PerlRawCode(`[map { [\$_, ${tmpRef}->{\$_}] } sort { $a <=> $b } keys \%{${tmpRef}}]`));
          // NOT wrapped in PerlGrouped: emitUnaryExpression's '@'/'%'/'$#'
          // dereference-bracing special-case (see PerlEmitter.js) detects a
          // "do {...}" operand needing "@{(do{...})}" bracing by regex-
          // matching the emitted text against /^(map|grep|sort|reverse|
          // do)\b/ - wrapping in an extra PerlGrouped changes that emitted
          // text to "(do {...})" (leading "(", not "do"), missing the
          // match and falling through to the unwrapped "@" + operand
          // default - a hard Perl syntax error ("@(do {...})") wherever
          // this result is later array-dereferenced (e.g. a for-of loop
          // over a getter-backed Object.entries(...) call).
          return new PerlCall('do', [new PerlBlock([decl, mapStmt])]);
        }

        // IL AST ObjectCreate - Object.create(proto) -> { %{$proto} }
        // Codebase-wide this pattern only ever clones a legacy object-literal
        // algorithm/instance (e.g. "const instance = Object.create(this);" in
        // a CreateInstance() method, or "_cipher: Object.create(AlgoObj)") -
        // bless the shallow copy into _LegacyAlgoObj too so subsequent
        // "->Method(...)" calls on the clone resolve the same way they do on
        // the original (see transformObjectExpression / usesLegacyAlgoObj).
        case 'ObjectCreate': {
          const proto = this.transformExpression(node.prototype);
          this.usesLegacyAlgoObj = true;
          if (node.properties) {
            // Object.create(proto, properties) - merge hashes
            const props = this.transformExpression(node.properties);
            return new PerlBless(new PerlRawCode(`{%{${proto}}, %{${props}}}`), '_LegacyAlgoObj');
          }
          return new PerlBless(new PerlRawCode(`{%{${proto}}}`), '_LegacyAlgoObj');
        }

        // IL AST IsIntegerCheck - Number.isInteger(x) -> ($x == int($x))
        case 'IsIntegerCheck': {
          const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          const intCall = new PerlCall('int', [value]);
          return new PerlGrouped(new PerlBinaryExpression(value, '==', intCall));
        }

        // IL AST DebugOutput - console.log/warn/error -> print/warn
        case 'DebugOutput': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          const method = node.method || 'log';
          if (method === 'warn' || method === 'error') {
            return new PerlCall('warn', args);
          }
          return new PerlCall('print', [...args, PerlLiteral.String("\\n", '"')]);
        }

        // IL AST DataViewWrite - view.setUint32(offset, value, le) -> pack/substr
        case 'DataViewWrite': {
          const view = this.transformExpression(node.view);
          const offset = this.transformExpression(node.offset);
          const value = this.transformExpression(node.value);
          const method = node.method;
          const littleEndian = node.littleEndian !== false;

          // Perl pack template. Float32/Float64 (setFloat32/setFloat64) must
          // be checked BEFORE the generic '32'/'64' substring checks below -
          // "setFloat64".includes('64') and "setFloat32".includes('32') are
          // both true, so without this the float writers fell through to the
          // integer 'Q'/'V' templates, pack()-ing the IEEE-754 double/float
          // *value* as if it were an integer bit pattern (e.g. packing 0.48
          // via 'Q<' truncates it to integer 0 first) - PRNGs that serialize
          // their output via DataView.setFloat64 (ran0/ran1/ran2/ran3,
          // mersenne-twister, ...) got all-zero or garbage bytes instead of
          // the double's actual byte representation.
          let fmt = method.includes('Float64') ? (littleEndian ? 'd<' : 'd>') :
                    method.includes('Float32') ? (littleEndian ? 'f<' : 'f>') :
                    method.includes('32') ? (littleEndian ? 'V' : 'N') :
                    method.includes('16') ? (littleEndian ? 'v' : 'n') : 'C';

          return new PerlRawCode(`substr(${view}, ${offset}, length(pack('${fmt}', ${value}))) = pack('${fmt}', ${value})`);
        }

        // IL AST DataViewRead - view.getUint32(offset, le) -> unpack/substr
        case 'DataViewRead': {
          const view = this.transformExpression(node.view);
          const method = node.method;

          // toString() is misclassified as DataViewRead by the IL - handle as string conversion
          if (method === 'toString') {
            // For number.toString(radix): sprintf with format
            if (node.offset && node.offset.type === 'Literal' && typeof node.offset.value === 'number') {
              const radix = node.offset.value;
              if (radix === 16) return new PerlCall('sprintf', [PerlLiteral.String('%x', "'"), view]);
              if (radix === 8) return new PerlCall('sprintf', [PerlLiteral.String('%o', "'"), view]);
              if (radix === 2) return new PerlCall('sprintf', [PerlLiteral.String('%b', "'"), view]);
              if (radix === 36) return new PerlRawCode(`do { my @_d = (0..9, 'a'..'z'); my $_n = ${view}; my $_s = ''; while ($_n > 0) { $_s = $_d[$_n % 36] . $_s; $_n = int($_n / 36); } $_s || '0'; }`);
            }
            // Plain toString() -> just stringify: "$value" or "" . $value
            return new PerlRawCode(`"${view}"`);
          }

          const offset = this.transformExpression(node.offset);
          const littleEndian = node.littleEndian !== false;

          if (method === 'getUint8')
            return new PerlRawCode(`ord(substr(${view}, ${offset}, 1))`);

          // Perl unpack template. 64-bit reads (getBigUint64/getBigInt64 -
          // named for JS's BigInt-typed DataView accessors, e.g.
          // hash/lsh.js's "view.getBigUint64(i * 8, true)") checked BEFORE
          // the 32/16-bit checks below, whose ".includes('32')"/".includes('16')"
          // both correctly return false for "getBigUint64" - but so did
          // EVERY check, silently falling through to the 1-byte 'C'
          // default (reading 1 byte instead of 8, entirely wrong data).
          //
          // Float64/Float32 (getFloat64/getFloat32) must be checked before
          // those generic '64'/'32' substring checks for the same reason -
          // "getFloat64".includes('64') is true, so without this a float
          // read used the integer 'Q<' unpack template, reinterpreting the
          // double's raw bytes as an unsigned 64-bit integer instead of
          // decoding them back to the IEEE-754 double.
          let fmt = method.includes('Float64') ? (littleEndian ? 'd<' : 'd>') :
                    method.includes('Float32') ? (littleEndian ? 'f<' : 'f>') :
                    method.includes('64') ? (littleEndian ? 'Q<' : 'Q>') :
                    method.includes('32') ? (littleEndian ? 'V' : 'N') :
                    method.includes('16') ? (littleEndian ? 'v' : 'n') : 'C';
          const size = method.includes('64') ? 8 : method.includes('32') ? 4 : method.includes('16') ? 2 : 1;

          return new PerlRawCode(`unpack('${fmt}', substr(${view}, ${offset}, ${size}))`);
        }

        // IL AST JsonSerialize - JSON.stringify(x) -> encode_json(x). The
        // type-aware-transpiler's IL node carries the argument under
        // `value` (see TypeAwareJSASTParser); node.argument is never set,
        // it was a wrong guess.
        case 'JsonSerialize': {
          const arg = this.transformExpression(node.value || node.argument);
          // Fully-qualified JSON::encode_json rather than relying on
          // addRequiredModule's "use JSON qw(encode_json)" import: that
          // import only takes effect in whatever package is currently being
          // compiled at the point the pragma line appears (emitted once,
          // near the top of the file, in package main) - every subsequent
          // "package Foo;" block (each transpiled class gets its own) does
          // NOT inherit it, so calling the bare "encode_json(...)" from
          // inside one dies with "Undefined subroutine &Foo::encode_json".
          // The module still needs loading somewhere, so keep that call
          // (with no import list - see addRequiredModule) purely to emit
          // "use JSON;".
          this.addRequiredModule('JSON');
          return new PerlCall('JSON::encode_json', [arg]);
        }

        // IL AST JsonDeserialize - JSON.parse(x) -> decode_json(x). The IL
        // node carries the argument under `text` (see TypeAwareJSASTParser),
        // not `argument`/`value` - reading those always yielded undefined,
        // silently turning every "JSON.parse(x)" into a zero-arg
        // "decode_json()" call (dies at runtime, or - since it's in a
        // different package than the "use JSON qw(decode_json)" import
        // point - "Undefined subroutine ... decode_json").
        case 'JsonDeserialize': {
          const arg = this.transformExpression(node.text || node.argument || node.value);
          this.addRequiredModule('JSON');
          return new PerlCall('JSON::decode_json', [arg]);
        }

        // IL AST ErrorCreation - new Error(msg)/TypeError(msg)/RangeError(msg)
        // Perl has no exception objects here; die takes a plain message, so
        // (as with the NewExpression 'Error' case above) this just resolves
        // to the message expression for use with die/PerlDie.
        case 'ErrorCreation':
          return node.message ? this.transformExpression(node.message) : PerlLiteral.String('Error', "'");

        // IL AST Random - Math.random() gets pre-converted to this dedicated
        // node type (see the CallExpression handling further up for the
        // "objName === 'Math' && methodName === 'random'" case, which never
        // actually fires because the IL pass beats it to the punch) -
        // unhandled here, this silently fell through to the "default: return
        // null" case below, which serialized as nothing at all (e.g. "$rng ?
        // $rng->next() : ;" - a syntax error, not just a wrong value).
        case 'Random':
          return new PerlCall('rand', []);

        default:
          return null;
      }
    }

    /**
     * Transform an identifier
     */
    transformIdentifier(node) {
      let name = node.name;

      // Map JavaScript keywords to Perl equivalents
      if (name === 'undefined') return PerlLiteral.Undef();
      if (name === 'null') return PerlLiteral.Undef();
      if (name === 'Infinity') return new PerlRawCode('9e999');
      if (name === 'NaN') return new PerlCall(new PerlIdentifier('0', ''), [new PerlRawCode("'nan'")]);
      // JS global objects - not meaningful in Perl, return undef. Checked
      // AFTER (not before) variableTypes below would be ideal, but this
      // early-return only applies when the name ISN'T itself a tracked
      // local variable/parameter - "window"/"self" in particular are
      // common, legitimate local variable names in this codebase having
      // nothing to do with the JS browser global (e.g.
      // compression/lzss.js's "const window = new Array(this.WINDOW_SIZE);"
      // sliding-window buffer) - without this guard, EVERY reference to
      // that local variable resolved to the literal Perl "undef" instead of
      // "$window", dying "Can't use an undefined value as an ARRAY
      // reference" wherever it was indexed.
      if ((name === 'global' || name === 'globalThis' || name === 'window' || name === 'self') && !this.variableTypes.has(name))
        return PerlLiteral.Undef();

      // Check if this identifier should be replaced with $_ (for List::Util callbacks)
      if (this._listUtilParamReplacement && name === this._listUtilParamReplacement) {
        return new PerlIdentifier('_', '$');
      }

      // If this variable has been explicitly registered (e.g., via my/our declaration),
      // always use the registered sigil - even if it looks like a class name
      if (this.variableTypes.has(name)) {
        const sigil = this.variableTypes.get(name);
        // A nested function's Perl variable may have been uniquely renamed
        // (see _collectNestedFunctionRenames' doc comment) - resolve it the
        // same way call sites do, so a bare value-read of the closure
        // (rather than a call) still names the right lexical.
        const emittedName = this.nestedFunctionNames.has(name) ? this._resolveNestedFunctionName(name) : name;
        return new PerlIdentifier(emittedName, sigil);
      }

      // Class names (PascalCase, TypedArrays, etc.) should have no sigil
      // They are used as barewords for method calls like Uint8Array->from()
      const isClassName = /^[A-Z]/.test(name) &&
        (this.definedClassNames.has(name) ||
         name.endsWith('Array') || name.endsWith('Algorithm') || name.endsWith('Instance') ||
         name.endsWith('Point') || name.endsWith('Cipher') || name.endsWith('Module') ||
         name.endsWith('Utils') || name.endsWith('Transform') || name.endsWith('Encoder') ||
         name.endsWith('Decoder') || name.endsWith('Generator') || name.endsWith('Factory') ||
         name.endsWith('Core') || name.endsWith('Constants') || name.endsWith('Helper') ||
         name.endsWith('Hasher') || name.endsWith('Tree') || name.endsWith('Front') ||
         name === 'Object' || name === 'Array' || name === 'String' || name === 'Number' ||
         name === 'Math' || name === 'JSON' || name === 'Date' || name === 'RegExp' ||
         name === 'Error' || name === 'Promise' || name === 'Map' || name === 'Set' ||
         name === 'WeakMap' || name === 'WeakSet' || name === 'Symbol' || name === 'BigInt' ||
         // TypedArrays
         name === 'Int8Array' || name === 'Uint8Array' || name === 'Uint8ClampedArray' ||
         name === 'Int16Array' || name === 'Uint16Array' ||
         name === 'Int32Array' || name === 'Uint32Array' ||
         name === 'Float32Array' || name === 'Float64Array' ||
         name === 'BigInt64Array' || name === 'BigUint64Array' ||
         name === 'ArrayBuffer' || name === 'DataView' ||
         // Common crypto/algorithm class names
         name === 'OpCodes' || name === 'AlgorithmFramework' || name === 'NumberTheory');

      if (isClassName) {
        // Return as quoted string - Perl resolves 'ClassName'->method() correctly
        // and this avoids bareword errors under 'use strict' in boolean/value context
        return PerlLiteral.String(name, "'");
      }

      // If this identifier refers to a declared sub and is used as a value (not as a callee),
      // emit a code reference: \&functionName. Package-qualified with
      // "main::" - top-level JS helper functions are emitted as top-level
      // Perl subs, which always land in "package main" (see
      // PerlEmitter.js emitModule), same as the direct-call qualification
      // just above (this.functionNames.has(funcName) branch). An
      // unqualified "\&functionName" written from inside a class's
      // "package Foo;" block (e.g. "this.permute = spongent160Permute;" -
      // see codeRefFieldNames' doc comment) resolves against the CURRENT
      // package at compile time, not main:: - silently binding to
      // "\&Foo::functionName" (which doesn't exist) instead of the real
      // sub, so calling the stored coderef later died "Undefined
      // subroutine &Foo::functionName called".
      if (this.functionNames.has(name) && !this.variableTypes.has(name)) {
        // See _collectNestedFunctionRenames' doc comment - a nested
        // function's Perl sub may have been given a unique per-method name.
        const qualified = this.nestedFunctionNames.has(name) ? this._resolveNestedFunctionName(name) : ('main::' + name);
        return new PerlUnaryExpression('\\&', new PerlIdentifier(qualified, ''), true);
      }

      // Get sigil from registered type or infer
      const sigil = this.variableTypes.get(name) || this.inferSigilFromName(name);

      return new PerlIdentifier(name, sigil);
    }

    /**
     * Transform a literal
     */
    transformLiteral(node) {
      // Regex literal (e.g. /[A-Za-z]/g) - a JS Literal node carries the
      // pattern/flags in a `.regex` sub-object rather than `.value` (which
      // for these nodes is usually a JS RegExp object the parser doesn't
      // meaningfully stringify). Without this check every regex literal
      // fell through to the `PerlLiteral.Number(0)` default below, so e.g.
      // `/[A-Za-z]/.test(char)` transpiled to the nonsensical
      // `0->test($char)` ("Can't locate object method "test" via package
      // "0""). Emitted as a bare Perl regex (qr-less, since it's only ever
      // consumed as the right-hand side of =~ - see transformCallExpression's
      // .test()/.match() handling immediately below).
      if (node.regex) {
        const flags = (node.regex.flags || '').replace(/[^gimsx]/g, '');
        return new PerlRegex(node.regex.pattern, flags);
      }

      if (typeof node.value === 'number') {
        return PerlLiteral.Number(node.value);
      }

      // BigInt literal (e.g. `16n`, `0xFFn`, `0xFFFFFFFFFFFFFFFFn`) - falling
      // through to the `return PerlLiteral.Number(0)` default below (the only
      // case typeof node.value === 'bigint' would otherwise hit) silently
      // zeroed out every BigInt-typed shift amount/mask/constant in the
      // 64-bit hash family (Tiger/Skein/Whirlpool/SHA-512/SipHash/BLAKE2b),
      // producing all-zero digests. Perl's native integers are 64-bit wide
      // on this platform (and beyond that transparently promote to UV for
      // values up to 2^64-1), so String(bigint) - e.g. "18446744073709551615"
      // for 0xFFFFFFFFFFFFFFFFn - parses back as the exact same value.
      if (typeof node.value === 'bigint') {
        // A BigInt literal wider than a native 64-bit integer (e.g.
        // random/lehmer64.js's "const MASK_128 = 0xFFFF...FFFFn;", 128 ones)
        // must NOT be emitted as a bare Perl numeric literal: Perl's integer
        // literal parsing tops out at UV_MAX (2**64-1) - anything past that
        // silently becomes a floating-point NV, permanently losing precision
        // (confirmed empirically: a 128-bit-all-ones mask stored as a bare
        // literal and later ANDed against an exact value corrupted the
        // result, since the literal itself was never exact to begin with).
        // Math::BigInt->new("<decimal digits>") preserves the exact value
        // regardless of width, and this constant then round-trips correctly
        // through any later Math::BigInt-backed arithmetic (band/bior/blsft/
        // ...) via operator/argument coercion.
        if (node.value > 0xFFFFFFFFFFFFFFFFn || node.value < -0x8000000000000000n) {
          this.addRequiredModule('Math::BigInt');
          return new PerlRawCode(`Math::BigInt->new("${node.value.toString()}")`);
        }
        return PerlLiteral.Number(node.value);
      }

      if (typeof node.value === 'string') {
        return PerlLiteral.String(node.value, "'");
      }

      if (typeof node.value === 'boolean') {
        return PerlLiteral.Number(node.value ? 1 : 0);
      }

      if (node.value === null) {
        return PerlLiteral.Undef();
      }

      // The bare `undefined` keyword parses as a Literal node with
      // resultType 'void' and .value left as JS `undefined` itself (not a
      // 'Literal' string/number/bigint/boolean, and not `null` either) -
      // every typeof-based branch above falls through, silently landing on
      // the `PerlLiteral.Number(0)` default below, exactly as if the source
      // had written the literal digit 0. That's not just "some other
      // fallback value" - 0 is often a legitimate, meaningfully-different
      // *result* itself (a stored array index/position, a hash value, ...),
      // so "x !== undefined" (comparing against this mistranslated 0)
      // treated a real, legitimate 0 identically to an unset/never-assigned
      // value - see compression/lzf.js's/lzfx.js's hash-chain lookup ("const
      // ref = htab[hidx]; if (ref !== undefined && ...)": a stored position
      // 0 is exactly as valid a match target as any other position, but got
      // silently treated as "never stored"). Correctly producing `undef`
      // here lets the dedicated "!== undefined -> defined()"/"===
      // undefined -> !defined()" rewrite in transformBinaryExpression (see
      // its doc comment) recognize and handle the comparison correctly;
      // outside a comparison, `undef` remains the right general-purpose
      // stand-in for JS's `undefined` (matching the existing `null ->
      // undef` mapping just above).
      if (node.value === undefined) {
        return PerlLiteral.Undef();
      }

      return PerlLiteral.Number(0);
    }

    /**
     * Transform a binary expression
     */
    /**
     * Does this (sub-)expression, read left-to-right through a chain of "&&"
     * operators, contain a non-computed "name.prop" MemberExpression whose
     * object is the bare identifier `name`? Feeds transformBinaryExpression's
     * "guard-clause && chain" HASH-ref-strengthening special case - see its
     * call site's doc comment.
     * @param {object} node
     * @param {string} name
     * @returns {boolean}
     */
    _chainReferencesMemberOf(node, name) {
      if (!node) return false;
      if (node.type === 'MemberExpression' && !node.computed &&
          node.object && node.object.type === 'Identifier' && node.object.name === name) {
        return true;
      }
      if (node.type === 'LogicalExpression' && node.operator === '&&') {
        return this._chainReferencesMemberOf(node.left, name) || this._chainReferencesMemberOf(node.right, name);
      }
      return false;
    }

    transformBinaryExpression(node) {
      // typeof X === 'string' / !== 'string' / == / != - the general
      // "case 'TypeOfExpression'" transform below (used when typeof isn't
      // directly compared to a literal) maps typeof to "ref($x) || 'SCALAR'"
      // - a Perl-native reference-type tag ('ARRAY'/'HASH'/'SCALAR'), which
      // can never equal a JS typeof string ('string'/'object'/'number'/...).
      // "(ref($x)||'SCALAR') eq 'string'" is therefore *always* false, even
      // for an actual string - silently taking the wrong branch of the
      // ubiquitous "typeof data === 'string' ? data : String.fromCharCode(
      // ...data)" polymorphic-input idiom (Feed()/Update() accepting either
      // a string or a byte array - see _inferStringParamsFromUsage's
      // isTypeofStringGuard comment for the same idiom). This codebase's
      // only two polymorphic input shapes are "plain string" and "byte
      // array", which map 1:1 onto Perl's "not a reference" vs "is an ARRAY
      // reference" - so typeof X === 'string' becomes the directly
      // equivalent, vocabulary-matched "!ref($X)" (and !== the negation),
      // handled here (a full BinaryExpression, not just the IfStatement/
      // ternary "!== 'undefined'" dead-code-guard special cases elsewhere)
      // since this check guards a real, executed runtime branch.
      const typeofStringArg = this._matchTypeofStringLiteral(node);
      if (typeofStringArg) {
        const argExpr = this.transformExpression(typeofStringArg);
        const refCall = new PerlCall('ref', [argExpr]);
        const isEq = node.operator === '===' || node.operator === '==';
        return isEq
          ? new PerlUnaryExpression('!', refCall, true)
          : refCall;
      }

      // typeof X.method === 'function' / !== 'function' - duck-typed
      // interface/method-existence check (e.g. modes/ede.js's/eee.js's
      // setBlockCipher validating its argument looks like a block cipher
      // instance) -> $X->can('method') - see
      // _matchTypeofFunctionLiteral's doc comment for why the generic
      // TypeOfExpression/MemberExpression lowering below gets this
      // completely wrong (always true, regardless of the actual argument).
      const typeofFunctionArg = this._matchTypeofFunctionLiteral(node);
      if (typeofFunctionArg) {
        const objExpr = this.transformExpression(typeofFunctionArg.object);
        const methodName = typeofFunctionArg.property?.name || typeofFunctionArg.property?.value;
        const canCall = new PerlCall(new PerlIdentifier('can'), [PerlLiteral.String(methodName, "'")]);
        canCall.isMethodCall = true;
        const canExpr = new PerlMemberAccess(objExpr, canCall, '->');
        const isEq = node.operator === '===' || node.operator === '==';
        return isEq ? canExpr : new PerlUnaryExpression('!', canExpr, true);
      }

      // Handle 'in' operator: key in obj -> exists $obj->{key}
      if (node.operator === 'in') {
        const key = this.transformExpression(node.left);
        const obj = this.transformExpression(node.right);
        // exists $obj->{$key}
        return new PerlCall('exists', [
          new PerlSubscript(obj, key, 'hash', true)
        ]);
      }

      // Handle instanceof operator: x instanceof Y -> ref($x) eq 'Y'
      // In Perl, we use ref() to check if a reference is blessed into a class
      if (node.operator === 'instanceof') {
        const left = this.transformExpression(node.left);
        // Get the class name from the right operand
        let className = '';
        if (node.right.type === 'Identifier') {
          className = node.right.name;
          // Handle typed arrays - in Perl these are just ARRAY refs
          if (className === 'Uint8Array' || className === 'Int8Array' ||
              className === 'Uint16Array' || className === 'Int16Array' ||
              className === 'Uint32Array' || className === 'Int32Array' ||
              className === 'Float32Array' || className === 'Float64Array' ||
              className === 'ArrayBuffer' || className === 'Array') {
            // Check if it's an array reference
            return new PerlBinaryExpression(
              new PerlCall('ref', [left]),
              'eq',
              PerlLiteral.String('ARRAY', "'")
            );
          }
        } else if (node.right.type === 'MemberExpression') {
          // Handle things like global.Uint8Array
          className = node.right.property.name || node.right.property.value || 'UNKNOWN';
          if (className === 'Uint8Array' || className === 'Array') {
            return new PerlBinaryExpression(
              new PerlCall('ref', [left]),
              'eq',
              PerlLiteral.String('ARRAY', "'")
            );
          }
        }
        // Default: ref($x) eq 'ClassName'
        return new PerlBinaryExpression(
          new PerlCall('ref', [left]),
          'eq',
          PerlLiteral.String(className, "'")
        );
      }

      // Guard-clause "&&" chain that truthy-tests a bare identifier
      // immediately before dotting into its properties (e.g. "keyData &&
      // keyData.publicKey && keyData.privateKey" - a common
      // polymorphic-input KeySetup(keyData) guard where keyData may be an
      // object, a byte array, or a string depending on the caller - see
      // dilithium.js/falcon.js/rainbow.js's KeySetup). JS's "obj.prop" on a
      // non-object silently yields undefined (falsy, short-circuiting the
      // chain) - Perl's "->{...}" arrow access on a non-HASH reference is
      // instead a hard runtime die ("Not a HASH reference"), crashing
      // whatever eval{} happened to wrap the call (frequently silently,
      // since KeySetup is invoked through the test harness's "eval {
      // $inst->$prop($val) }" property setter, swallowing the die and
      // leaving the key never actually set). Strengthening the leading
      // identifier's truthy-check into a HASH-ref check is always at least
      // as correct as the plain truthy check: true exactly when $X is a
      // genuine hashref (the only shape ".prop" access on $X could
      // meaningfully succeed on anyway), false whenever $X is a non-ref or
      // wrong-ref value the same way JS's undefined property read would
      // already have short-circuited the chain.
      if (node.operator === '&&' && node.left.type === 'Identifier' &&
          this._chainReferencesMemberOf(node.right, node.left.name)) {
        const guardedLeft = new PerlBinaryExpression(
          new PerlCall('ref', [this.transformExpression(node.left)]),
          'eq',
          PerlLiteral.String('HASH', "'")
        );
        const guardedRight = this.transformExpression(node.right);
        return new PerlBinaryExpression(guardedLeft, '&&', guardedRight);
      }

      // "(a * b) % m" / "(a * b + c) % m" in a BigInt-flagged file: JS
      // BigInt computes the multiplication (and any +/- chained onto it)
      // at full arbitrary precision before reducing by the modulus - the
      // classic LCG state update "X = (X * multiplier) % primeModulus" or
      // "X = (X * multiplier + increment) % primeModulus" (e.g.
      // random/wichmann-hill.js's/mwc.js's/cmwc.js's/combined-lcg.js's
      // 64-bit-prime generators). Perl scalars are native 64-bit integers;
      // the generic '*'/'+'/'-' case below routes BigInt-file arithmetic
      // through OpCodes::u64mul/u64add/u64sub, which wrap to exactly 64
      // bits (inside a `use integer` block) *before* this modulus
      // reduction ever runs - only correct when the modulus is a power of
      // two. These moduli are large primes within ~100 of 2**64, so
      // wrapping first throws away information the true mod needs: (a*b)
      // mod 2**64, then mod p, is not the same value as (a*b) mod p
      // whenever the product actually overflows 64 bits (it does here -
      // two ~64-bit operands multiply to ~128 bits) - every generated
      // value came out wrong as a result. Detected structurally (the '%'
      // operand is itself a '+'/'-'/'*' BinaryExpression, recursively
      // rebuilt via _buildExactBigIntExpr below) rather than by widening
      // the generic '*'/'%' cases themselves, since widening every '*'
      // through Math::BigInt previously regressed the xorshift/xoshiro/
      // romu rotate family, which *wants* u64mul's 64-bit hardware-
      // wraparound semantics.
      //
      // Gated additionally on the modulus operand *not* being a provably
      // narrow type, not merely "this file happens to use BigInt literals
      // somewhere" - block/hpc.js (which uses BigInt state throughout)
      // also contains plain small-index modulo like "(bitSize - 1) % 64"
      // (modulus resultType 'int32', operating on ordinary Numbers,
      // immediately re-wrapped by an outer BigInt(...) cast) -
      // structurally identical to the LCG shape but not needing exact-
      // precision handling at all. Routing that through Math::BigInt
      // produced a blessed object where plain-integer code expected a
      // normal scalar (a shift amount/array index), corrupting values
      // that were already correct under plain u64 arithmetic. Checking
      // for "not narrow" rather than "is wide" (mirroring the '~' unary
      // case's WIDE_RESULT_TYPES/NARROW_RESULT_TYPES doc comment below)
      // because the type-aware parser can't always infer a resultType for
      // a `this.`-property modulus (e.g. random/combined-lcg.js's runtime-
      // configurable this._modulo, resultType null) - only a positively-
      // identified small integer literal/expression is safe to exclude.
      if (node.operator === '%' && this._fileHasBigIntLiterals &&
          node.left && node.left.type === 'BinaryExpression' &&
          (node.left.operator === '*' || node.left.operator === '+' || node.left.operator === '-') &&
          !this._isNarrowResultType(node.right?.resultType)) {
        this.addRequiredModule('Math::BigInt');
        const exactLeft = this._buildExactBigIntExpr(node.left);
        const modRight = this.transformExpression(node.right);
        return new PerlRawCode(`(${exactLeft})->bmod(${modRight})`);
      }

      // "(a * b) & wideMask" / "(a + b) & wideMask" in a BigInt-flagged
      // file - the same overflow shape as the '%'-of-'*'/'+'/'-' case just
      // above, but masked with "&" against a mask WIDER than 64 bits
      // instead of reduced with "%" against a modulus - e.g.
      // random/lehmer64.js's Lehmer64 state update "this._state =
      // OpCodes.AndN(this._state * MULTIPLIER, MASK_128)" (both operands up
      // to 64 bits, product up to 128 - MASK_128 keeps the full 128-bit
      // product, later split into high/low 64-bit halves). The generic
      // '*'/'+'/'-' case a BigInt-flagged file normally gets (u64mul/
      // u64add/u64sub, exact only up to 64 bits inside a `use integer`
      // block) truncates the product to 64 bits *before* this mask ever
      // runs, permanently losing the high half. Gated on the mask being
      // POSITIVELY known wide (_isWideBigIntMask, resolving a top-level
      // "const MASK_128 = 0xFFFF...FFFFn;" declaration - see its doc
      // comment) rather than "not narrow" like the '%' case: an ordinary
      // (<=64-bit) mask like the same file's sibling MASK_64 is exactly
      // what the 64-bit-wraparound-wanted u64mul/u64add family already
      // handles correctly, and failing open (as the '%' case does) would
      // wrongly route every ordinary 32/64-bit "(a*b) & mask" through
      // Math::BigInt too.
      if (node.operator === '&' && this._fileHasBigIntLiterals &&
          node.left && node.left.type === 'BinaryExpression' &&
          (node.left.operator === '*' || node.left.operator === '+' || node.left.operator === '-') &&
          this._isWideBigIntMask(node.right)) {
        this.addRequiredModule('Math::BigInt');
        const exactLeft = this._buildExactBigIntExpr(node.left);
        const maskRight = this.transformExpression(node.right);
        return new PerlRawCode(`(${exactLeft})->band(${maskRight})`);
      }

      let left = this.transformExpression(node.left);
      let right = this.transformExpression(node.right);

      // "<X>Module.PropName" used directly (not negated, not `new`'d) as a
      // boolean operand of a "&&"/"||" chain - e.g. mac/dstu7624mac.js's
      // "if (!KalynaAlgorithm && KalynaModule && KalynaModule.
      // KalynaAlgorithm) { KalynaAlgorithm = new KalynaModule.
      // KalynaAlgorithm(); }". transformMemberExpression's own
      // _isUmdDependencyModuleAccess branch (relied on by the "new" call
      // right after, which correctly becomes "KalynaAlgorithm->new()")
      // turns this same MemberExpression into a bare class-name Identifier
      // with no meaningful truthiness of its own outside a "->"/"new"
      // context - used standalone as a "&&"/"||" operand, that bareword
      // dies "not allowed while strict subs in use" at COMPILE time (same
      // defect as the already-handled negated "!X.Y" unary case elsewhere
      // in this file - only differing in polarity). The dependency's
      // presence is guaranteed by successful compilation once bundled
      // (mirrors that case's rationale), so treat it as always-true here
      // too, in-place, without disturbing the rest of the chain.
      // "<X>.Find" (bare, non-computed, non-call property read) used as a
      // "&&"/"||" operand - e.g. asymmetric/ecdsa.js's "typeof
      // AlgorithmFramework !== 'undefined' && AlgorithmFramework.Find" and
      // mac/iso9797alg3.js's "(AF && AF.Find) ? AF.Find('DES') : null" /
      // "!this._desAlgorithm && this._algorithmFramework &&
      // this._algorithmFramework.Find" - a "does the AlgorithmFramework/
      // registry object have a Find method" sanity guard. "AF" here often
      // holds the quoted-string form of a known class name (see
      // transformIdentifier's isClassName branch - e.g. 'AlgorithmFramework'
      // as a fallback value), not a blessed reference, so "$AF->{'Find'}"
      // (the generic bare-property-read fallback) dies "Can't use string
      // (...) as a HASH ref" - and even for a genuine object reference,
      // Find is always a real sub in the bundled AlgorithmFramework/
      // registry package once compilation succeeds. Same rationale as the
      // UMD-dependency-module-access case just below: presence is
      // guaranteed post-bundling, so treat the check as always-true.
      const isFindPresenceCheck = (n) => n.type === 'MemberExpression' && !n.computed &&
        (n.property?.name || n.property?.value) === 'Find';

      if (node.operator === '&&' || node.operator === '||') {
        if (node.left.type === 'MemberExpression' && (this._isUmdDependencyModuleAccess(node.left) || isFindPresenceCheck(node.left)))
          left = PerlLiteral.Number(1);
        if (node.right.type === 'MemberExpression' && (this._isUmdDependencyModuleAccess(node.right) || isFindPresenceCheck(node.right)))
          right = PerlLiteral.Number(1);
      }

      // Wrap assignment expressions in parentheses when used as operands
      // JavaScript: (x = a - b) <= max  must become Perl: ($x = $a - $b) <= $max
      // Without parens, Perl would parse: $x = ($a - $b <= $max) which is wrong
      if (node.left.type === 'AssignmentExpression') {
        left = new PerlGrouped(left);
      }
      if (node.right.type === 'AssignmentExpression') {
        right = new PerlGrouped(right);
      }

      // "x !== undefined" / "x === undefined" (and the loose "!="/"==" forms)
      // - NOT a "typeof x !== 'undefined'" guard (handled separately above/
      // elsewhere), but a direct comparison against the bare `undefined`
      // identifier, e.g. compression/lzf.js's/lzfx.js's LZ77-style hash-
      // chain lookup: "const ref = htab[hidx]; if (ref !== undefined && ...)"
      // guarding "was this hash bucket ever populated". The generic
      // "==="/"!==" mapping just below always becomes Perl's numeric "=="/
      // "!=" (or string "eq"/"ne") - comparing *against* `undef` with "!="
      // coerces undef to 0 (with a "Use of uninitialized value" warning),
      // so "ref !== undefined" silently became "$ref != 0", which is false
      // (treating the bucket as "already populated") whenever a genuinely
      // unpopulated/never-stored bucket happened to compare equal to 0 -
      // and true (treating a *populated* bucket holding the legitimate
      // value 0, e.g. buffer position 0) as still "populated" only by
      // accident of never matching 0 elsewhere; the actual bug is that a
      // real, stored position 0 got treated identically to an empty slot
      // in every other comparison context. Perl's own "is this defined"
      // check is `defined($x)`, which is exactly what JS's "!== undefined"
      // means for a plain variable/property read (as opposed to a
      // TDZ-style reference error) - this is the general fix for the whole
      // family regardless of which file it shows up in.
      if ((node.operator === '!==' || node.operator === '!=' || node.operator === '===' || node.operator === '==')) {
        const leftIsUndef = left instanceof PerlLiteral && left.literalType === 'undef';
        const rightIsUndef = right instanceof PerlLiteral && right.literalType === 'undef';
        if (leftIsUndef !== rightIsUndef) {
          const valueOperand = leftIsUndef ? right : left;
          const definedCall = new PerlCall('defined', [valueOperand]);
          const isNotEqual = node.operator === '!==' || node.operator === '!=';
          return isNotEqual ? definedCall : new PerlUnaryExpression('!', definedCall, true);
        }
      }

      // Map operators
      let operator = node.operator;

      // Equality operators: choose string or numeric based on context
      // In crypto code, most comparisons are numeric (lengths, counters, etc.)
      if (operator === '===' || operator === '==') {
        operator = this.isStringContext(node.left, node.right) ? 'eq' : '==';
      }
      if (operator === '!==' || operator === '!=') {
        operator = this.isStringContext(node.left, node.right) ? 'ne' : '!=';
      }

      // Relational operators: same string-vs-numeric choice as equality
      // above - e.g. classical-cipher "isUpperCase = char >= 'A' && char <=
      // 'Z'" case-range checks (14 algorithms/classical/*.js files use this
      // exact idiom) previously always emitted Perl's numeric </<=/>/>=,
      // which silently coerces both a single-character string operand AND
      // the 'A'/'Z' literal to 0 ("Argument "X" isn't numeric" warnings) -
      // so the comparison was always "0 >= 0", always true, misclassifying
      // every character (including punctuation/digits) as uppercase.
      if (operator === '<' || operator === '>' || operator === '<=' || operator === '>=') {
        if (this.isStringContext(node.left, node.right)) {
          operator = { '<': 'lt', '>': 'gt', '<=': 'le', '>=': 'ge' }[operator];
        }
      }

      // String concatenation
      if (operator === '+' && this.isStringContext(node.left, node.right)) {
        operator = '.';
      }

      // Logical operators
      if (operator === '&&') operator = '&&';
      if (operator === '||') operator = '||';

      // Unsigned right shift: JS's ">>>" spec is ToUint32(x) THEN shift -
      // the operand is reduced to unsigned 32-bit *before* shifting, so
      // only zero bits are ever shifted in from the top. Masking is NOT
      // equivalent the other way around ("(x >> n) & 0xFFFFFFFF", masking
      // only *after* shifting): Perl's own ">>" on a negative operand
      // treats it as its full-width (64-bit) unsigned value (sign-extended
      // across all 64 bits, not just 32), so shifting first pulls in
      // 1-bits from that 64-bit-wide sign extension into the result's
      // upper bits - bits a genuine 32-bit-wide shift would never produce
      // - and the trailing "& 0xFFFFFFFF" mask no longer removes them
      // once they've been shifted down into the low 32 bits. This
      // silently corrupted every OpCodes.Shr32/UShr32 (or bare ">>>")
      // call whose left operand could be negative - e.g. any value that
      // passed through Math.imul (which returns a *signed* int32,
      // typically ported as Perl's "unpack('l', pack('l', ...))" - see
      // the 'CallExpression'/Math.imul case) and was later right-shifted
      // without an intervening additive re-mask, such as MurmurHash3's
      // finalization avalanche ("h1 ^= h1 >>> 16" straight after a
      // Math.imul). Masking the operand to unsigned 32-bit *before*
      // shifting (matching the spec's actual operation order) is correct
      // regardless of the operand's sign.
      if (operator === '>>>') {
        const maskedLeft = new PerlBinaryExpression(new PerlGrouped(left), '&', PerlLiteral.Hex(0xFFFFFFFF));
        // JS's ">>>" (like "<<"/">>") always reduces its shift-count
        // operand mod 32 ("ToUint32(positions) & 0x1F") before shifting -
        // see the masking rationale in PerlEmitter.js's emitOpCodesRuntimeStub
        // shr32/shl32 stubs (same underlying JS-spec quirk, same fix: mask
        // the *shift count*, not just the value). Perl's native ">>" has no
        // such masking, so an unmasked shift count >= 32 silently shifted
        // everything out to 0 instead of wrapping around.
        const maskedRight = this._isSmallShiftLiteral(node.right) ? right
          : new PerlBinaryExpression(new PerlGrouped(right), '&', PerlLiteral.Number(31));
        const shiftExpr = new PerlBinaryExpression(new PerlGrouped(maskedLeft), '>>', maskedRight);
        return new PerlBinaryExpression(shiftExpr, '&', PerlLiteral.Hex(0xFFFFFFFF));
      }

      // Plain (non-BigInt) "<<"/">>": same shift-count masking as '>>>'
      // above - JS reduces the shift count mod 32 for these too, and a
      // literal shift count already known to be in [0,31] needs no runtime
      // mask (_isSmallShiftLiteral keeps the common case's emitted code
      // exactly as before).
      if ((operator === '<<' || operator === '>>') && !this._fileHasBigIntLiterals) {
        if (!this._isSmallShiftLiteral(node.right)) {
          const maskedRight = new PerlBinaryExpression(new PerlGrouped(right), '&', PerlLiteral.Number(31));
          return new PerlBinaryExpression(left, operator, maskedRight);
        }
      }

      // A left-shift by 64 or more bits in a BigInt-flagged file (e.g.
      // mac/poly1305.js's field prime "OpCodes.ShiftLn(BigInt(1),
      // BigInt(130)) - BigInt(5)" for 2^130-5, which the shared IL builder
      // reduces to a plain "1 << 130" BinaryExpression before this
      // transformer ever sees it) genuinely exceeds even a 64-bit-
      // wraparound-safe native Perl integer - unlike the u64add/u64sub/
      // u64mul family just below, which only needs to stay exact up to
      // 2**64. Perl's native "<<" is undefined behavior (in practice,
      // silently yields 0) for a shift count at or beyond the platform's
      // integer width, so "1 << 130" silently became 0, and every later
      // "% $p" against that zero modulus died "Illegal modulus zero".
      // Route through Math::BigInt instead - once the result is a blessed
      // Math::BigInt object, its overloaded +/-/*/% operators automatically
      // upgrade any plain-scalar operand for that one operation (and the
      // u64add/u64sub/u64mul "use integer" pragma does not defeat operator
      // overloading, which Perl resolves before applying any numeric-
      // context pragma), so no other arithmetic in the same expression
      // chain needs to change to stay exact.
      // NOTE: widening this to route EVERY '<<' in a BigInt-flagged file
      // through Math::BigInt (attempted to fix random/lfsr258.js's state,
      // which genuinely grows past 64 significant bits across iterations -
      // confirmed by instrumenting the JS original: z2's state reaches 92
      // bits after 2 iterations) regressed 10 previously-passing files
      // (xoroshiro*/xoshiro*/romu* family, whose OpCodes.RotL64n/RotR64n
      // reduce to this same "(v << k | v >> (64-k)) & mask64" shape) - most
      // likely because a state variable that becomes a blessed Math::BigInt
      // object on one iteration doesn't round-trip identically back through
      // later byte-extraction/sprintf formatting the way a plain scalar
      // does, or the sheer object-allocation overhead in a multi-hundred-
      // iteration seeding loop pushes some vectors over the harness's
      // timeout. Reverted to the narrow (shiftAmount >= 64) case only,
      // pending a way to distinguish "value needs to keep growing past 64
      // bits" (lfsr258's Tausworthe recurrence) from "value must wrap at
      // 64 bits like real hardware" (every rotate) that doesn't regress the
      // latter, much larger population of already-correct files.
      if (operator === '<<' && this._fileHasBigIntLiterals) {
        // right.value may be a plain JS number OR an actual BigInt primitive
        // (see the 'Literal'/typeof === 'bigint' case above, e.g. JS source
        // "BigInt(130)"/"130n") - Number(...) normalizes either to a
        // comparable JS number (safe here: shift amounts are always small).
        const shiftAmount = (right instanceof PerlLiteral && right.literalType === 'number' &&
          (typeof right.value === 'number' || typeof right.value === 'bigint')) ? Number(right.value) : null;
        if (typeof shiftAmount === 'number' && shiftAmount >= 64) {
          this.addRequiredModule('Math::BigInt');
          return new PerlRawCode(`Math::BigInt->new(${left})->blsft(${right})`);
        }

        // "<constant> << <non-literal amount>" - e.g. the poly1305-family
        // MAC's per-block padding-bit idiom "OpCodes.ShiftLn(BigInt(1),
        // blockSize * 8)" (reaches 2**128 when blockSize is a full 16-byte
        // block). The shift amount here isn't a compile-time literal, so
        // the "shiftAmount >= 64" case just above never fires, and Perl's
        // native "<<" is undefined behavior (in practice 0) once the
        // *runtime* shift count reaches/exceeds the platform's integer
        // width - silently zeroing the padding term for a full-size final
        // block. Shifting a bare numeric literal (rather than an actual
        // accumulator/state variable) is never the 64-bit-hardware-
        // wraparound rotate idiom "v << k | v >> (64-k)" (which always
        // shifts a *variable* holding live state, never a constant) - safe
        // to route through Math::BigInt unconditionally whenever the left
        // operand is a bare numeric literal and the amount isn't already
        // known small.
        const leftIsNumericLiteral = node.left && (
          (node.left.type === 'Literal' && typeof node.left.value !== 'string') ||
          (node.left.type === 'BigIntCast' && node.left.argument && node.left.argument.type === 'Literal')
        );
        if (shiftAmount === null && leftIsNumericLiteral) {
          this.addRequiredModule('Math::BigInt');
          return new PerlRawCode(`Math::BigInt->new(${left})->blsft(${right})`);
        }

        // A literal shift amount < 64 whose LEFT operand is nonetheless
        // provably narrow enough that the combined result still exceeds
        // 64 bits - e.g. block/present.js's PRESENT-128 key schedule's
        // "(roundCounter & 0x1F) << 62" (roundCounter bounded to 5 bits:
        // 5 + 62 = 67 > 64) or PRESENT-80's "(key & ((1n<<19n)-1n)) <<
        // 61" (19 + 61 = 80 > 64). Neither of the two cases above catches
        // this: the shift amount itself is < 64, and the left operand is
        // a computed expression/variable, not a bare numeric literal.
        // Perl's native "<<" silently truncates/is undefined behavior
        // once the shift's mathematical result exceeds the platform's
        // native integer width - exactly the real-hardware-register
        // overflow this codebase's OWN u64-family helpers deliberately
        // emulate for the 64-bit hash/PRNG family, but wrong here since
        // JS BigInt "<<" never truncates. _estimateMaxBitWidth only
        // returns a number when it can POSITIVELY prove a bound (a
        // resolvable literal, an inline "(1<<N)-1" mask, an "& mask"
        // structurally bounding either operand, or a local "const"
        // matching one of those shapes elsewhere in the file) - failing
        // closed (leaving this case unrouted, same as before) whenever it
        // can't, so this never misfires on the rotate family's own "v <<
        // k" (v's width is never resolvable this way, since it's live
        // mutable round state, not a masked/literal-bounded expression).
        if (typeof shiftAmount === 'number' && shiftAmount < 64) {
          const leftWidth = this._estimateMaxBitWidth(node.left);
          if (typeof leftWidth === 'number' && leftWidth + shiftAmount > 64) {
            this.addRequiredModule('Math::BigInt');
            return new PerlRawCode(`Math::BigInt->new(${left})->blsft(${right})`);
          }
        }
      }

      // Perl's native "+"/"-" silently promote to a floating-point NV once
      // the mathematical result no longer fits in a 64-bit IV/UV, permanently
      // losing precision - unlike JS BigInt, which is exact at any size. The
      // 64-bit hash/PRNG family (Tiger/Skein/Whirlpool/SHA-512/SipHash/
      // BLAKE2b) constantly adds/subtracts values already near 2**64 (e.g.
      // "OpCodes.AndN(h + S1 + ch + K[t] + W[t], 0xFFFFFFFFFFFFFFFFn)" in
      // SHA-512, or Skein's unmasked "b0 += b1" chains that only get masked
      // several operations later inside a helper) - every such float
      // promotion corrupts the low bits before the subsequent "& mask" ever
      // runs, which is exactly why this family came back all-zero. Route
      // through OpCodes::u64add/u64sub (see PerlEmitter.js
      // emitOpCodesRuntimeStub), which does the add/sub inside a `use
      // integer` lexical scope to force exact 64-bit wraparound arithmetic
      // instead of float promotion. Safe to apply unconditionally to every
      // "+"/"-" in a BigInt-flagged file: for small/negative results (loop
      // counters, indices) `use integer` arithmetic is bit-for-bit identical
      // to normal Perl arithmetic, and no mask is applied here (unlike the
      // outer AndN mask already present in the source where one is needed),
      // so a negative result stays negative - only the float-promotion path
      // is avoided. Skipped for genuine float literal operands (harmless in
      // practice - this file family never mixes floats with 64-bit hash
      // state - but cheap to guard).
      if ((operator === '+' || operator === '-' || operator === '*') && this._fileHasBigIntLiterals &&
          !this._isFloatLiteralNode(node.left) && !this._isFloatLiteralNode(node.right)) {
        return this._u64SafeArithCall(operator, left, right);
      }

      // "/" in a BigInt-flagged file: JS BigInt division is exact
      // arbitrary-precision division truncated toward zero - Perl's
      // native "/" always promotes to a floating-point NV, even for
      // plain-integer operands, silently producing a tiny nonzero float
      // instead of the true integer quotient (e.g. "1 / <64-bit prime>"
      // stays a nonzero float, never becoming the 0 a later "quotient ===
      // 0n" check needs - see random/wichmann-hill.js's/mwc.js's
      // seed()-by-repeated-division idiom, which came back with junk
      // float remnants in state instead of the intended MAX_U64
      // fallback). Routed through OpCodes::u64div (Math::BigInt-backed,
      // see PerlEmitter.js emitOpCodesRuntimeStub's doc comment there for
      // why a plain `use integer; $a / $b` doesn't work for these
      // near-2**64 moduli). Gated on the divisor not being a provably
      // narrow type for the same reason as the '%'-of-arithmetic case
      // above: block/hpc.js's plain "Math.ceil(bitSize / 8)" byte-count
      // helper (divisor a narrow int32 literal) doesn't need Math::BigInt
      // at all, and round-tripping a value through OpCodes::u64div's
      // bstr()-returned digit string instead of a plain float measurably
      // changed *which* branch/index later float-precision-dependent code
      // took, unlike the genuine 64-bit-prime-modulus division idiom this
      // rule targets.
      if (operator === '/' && this._fileHasBigIntLiterals && !this._isNarrowResultType(node.right?.resultType)) {
        this.addRequiredModule('Math::BigInt');
        this.usesOpCodesRuntimeFallback = true;
        return new PerlCall(
          new PerlMemberAccess(new PerlIdentifier('OpCodes'), new PerlIdentifier('u64div'), '::'),
          [left, right]
        );
      }

      // JS BigInt "**" (exponentiation) in a BigInt-flagged file - e.g.
      // block/ff.js's BigIntegerUtils.pow() static helper ("return base **
      // exponent;"), computing radix**length for FF1's numeral-to-BigInt
      // range (radix up to 65536, length up to ~19 - the result routinely
      // exceeds even a native 64-bit integer, let alone the ~2**53 a
      // double can represent exactly). Perl's native "**" always computes
      // in floating point (NV), silently rounding once the true
      // mathematical result exceeds a double's precision - unlike JS
      // BigInt "**", which is exact at any size. Routed through
      // Math::BigInt's bpow(), which stays exact regardless of magnitude.
      // Safe unconditionally in a BigInt-flagged file: unlike '*'/'+'/'-'
      // (which the 64-bit hash/PRNG family uses constantly and
      // deliberately wants native 64-bit hardware wraparound for, via
      // u64add/u64mul), a literal "**" operator is vanishingly rare
      // outside this exact exact-precision-power idiom in this codebase.
      if (operator === '**' && this._fileHasBigIntLiterals) {
        this.addRequiredModule('Math::BigInt');
        return new PerlRawCode(`Math::BigInt->new("${left}")->bpow(${right})`);
      }

      // Plain (non-BigInt) multiplication: JS numbers are always IEEE-754
      // doubles, so a raw "a * b" that isn't routed through Math.imul/
      // OpCodes.Mul32 (those already truncate to an exact 32-bit product,
      // matching Perl's native exact-integer "*" one-for-one) silently
      // loses precision once the mathematical product exceeds 2**53 - e.g.
      // two ~32-bit operands (hash accumulator * prime constant) produce a
      // product up to ~2**64. Perl scalars are native 64-bit integers, so
      // "$a * $b" computes the mathematically *exact* product with no
      // rounding at all - diverging from JS's own (equally deterministic,
      // just lossy) result the instant the product crosses that 2**53
      // boundary. This is exactly why xxHash32/MurmurHash3/CityHash/etc.'s
      // per-block avalanche multiplies (raw "acc * PRIME", immediately
      // masked to uint32) came back with the mathematically "correct"
      // hash instead of the one these algorithms' own JS actually computes
      // and hard-codes into their test vectors. Forcing the multiplication
      // itself through genuine Perl floating-point (NV) arithmetic
      // reproduces V8's IEEE-754 double rounding bit-for-bit (both are
      // plain hardware "double * double"); the matching safe-extraction
      // half of this fix is the Cast/'uint32' case above (native "&"
      // mis-truncates a sufficiently large NV in practice - see u32mask's
      // doc comment in PerlEmitter.js's emitOpCodesRuntimeStub). Safe for
      // the common small-operand case too: doubles represent every integer
      // up to 2**53 exactly, so forcing float arithmetic there changes
      // nothing about the result, only (negligibly) how it's computed.
      if (operator === '*' && !this._fileHasBigIntLiterals) {
        return this._forceDoubleMultiply(left, right);
      }

      // NOTE: a "+"/"-" immediately combining with a forced-double multiply
      // (the "acc * PRIME + c" / LCG "state * A + C" shape - e.g. ecc/
      // repeat-accumulate-code.js's seeded Fisher-Yates interleaver) was
      // investigated here for a double-rounding mismatch (this Perl
      // build's native "+" appears to evaluate a forced-double NV operand's
      // addition using extended/80-bit intermediate precision in some
      // contexts, rounding differently than V8's single-step 64-bit
      // rounding) - bit-for-bit testing showed the discrepancy is context-
      // dependent in a way that a source-level pack('d',...)/unpack('d',
      // ...) round-trip could not reliably pin down (the SAME textual
      // expression rounded differently depending on whether it ran at
      // Perl top level vs. inside a closure, and fixing one iteration's
      // divergence surfaced a new one at the next), so no general fix is
      // applied here. Left as a known, narrow residual (affects a small
      // number of seeded-PRNG algorithms whose internal state exceeds
      // 2**53) rather than risking a broad, unreliable change to every
      // other file's "+"/"-" arithmetic.
      // JS's "x | 0" / "0 | x" idiom - the ubiquitous ToInt32-coercion
      // ("cast to 32-bit integer") convention, distinct from a genuine
      // bitwise-OR of two meaningful operands (see the identical 'int'/
      // 'int32' Cast-node case above, which handles the equivalent
      // OpCodes.ToInt(x)/OpCodes.ToInt32(x) call form - this covers the
      // raw-operator spelling, which the shared IL pass leaves as a plain
      // BinaryExpression instead of pre-converting to a Cast node). Perl's
      // native "|" has no such 32-bit truncation: "$x | 0" on a value
      // already outside the int32 range (e.g. block/rc.js's RC6 key
      // schedule seeding "RC_MAGIC_P|0", 0xb7e15163) is left completely
      // unmasked, diverging from JS the moment that value reaches later
      // modulo-2**32 arithmetic. Masked to 0xFFFFFFFF (unsigned, not
      // sign-extended) to match the rest of this codebase's uint32-
      // everywhere convention - see the 'int'/'int32' Cast case's own doc
      // comment for why unsigned rather than a signed pack('l',...).
      if (operator === '|') {
        const isZeroLiteral = (n) => n && (n.type === 'Literal' || n.type === 'NumberLiteral') && n.value === 0;
        if (isZeroLiteral(node.right) && !isZeroLiteral(node.left)) {
          return new PerlBinaryExpression(new PerlGrouped(left), '&', PerlLiteral.Hex(0xFFFFFFFF));
        }
        if (isZeroLiteral(node.left) && !isZeroLiteral(node.right)) {
          return new PerlBinaryExpression(new PerlGrouped(right), '&', PerlLiteral.Hex(0xFFFFFFFF));
        }
      }

      // "X || defaultValue" where X is string-typed - e.g. kdf/bcrypt.js's
      // custom base64 decoder's out-of-range-safe character access
      // "str[i++] || '.'" (falls back to '.' only when the index runs past
      // the end of the string). Perl's native "||" treats FIVE values as
      // false: undef, 0, 0.0, "", and the single-character string "0" -
      // whereas JS only treats "" (and undefined/null/NaN/0/false) as
      // falsy; a non-empty string is ALWAYS truthy in JS, including the
      // string "0". Whenever the source string's i-th character genuinely
      // is "0" (as happens partway through decoding "...VCzI2bS7...", the
      // literal digit character '0'), Perl's own "||" wrongly discarded
      // that real, in-range "0" character and substituted the default '.'
      // instead - corrupting exactly one decoded byte per occurrence, with
      // no error of any kind (a perfectly plausible-looking but wrong
      // decode). Only fires when the LEFT operand is known string-typed
      // (isStringType) - a numeric "X || 0" default (this codebase's much
      // more common idiom, e.g. hash-table bucket lookups) is already
      // correct under Perl's native "||", since 0 is falsy in both
      // languages there; rewriting that case too would be a needless,
      // unproven-safe behavior change for working code.
      if (operator === '||' && this.isStringType(node.left)) {
        return new PerlRawCode(`do { my $_or_lhs = ${left}; (defined($_or_lhs) && $_or_lhs ne '') ? $_or_lhs : (${right}) }`);
      }

      return new PerlBinaryExpression(left, operator, right);
    }

    /**
     * Force a multiplication to evaluate as genuine IEEE-754 double
     * arithmetic in Perl, reproducing JS Number semantics for a raw "a * b"
     * - see the doc comment at its call site in transformBinaryExpression.
     * "1.0 * left * right" (rather than e.g. wrapping each operand in
     * "+0.0") promotes the whole left-to-right chain to NV with a single
     * literal, at the same '*' operator precedence as a plain multiply, so
     * no extra parenthesization is needed relative to the un-forced form.
     * @param {PerlNode} left - already-transformed left operand
     * @param {PerlNode} right - already-transformed right operand
     * @returns {PerlBinaryExpression}
     */
    _forceDoubleMultiply(left, right) {
      const one = new PerlRawCode('1.0');
      const result = new PerlBinaryExpression(new PerlBinaryExpression(one, '*', left), '*', right);
      // Marker consumed by _containsForcedDoubleMultiply (see the Cast/
      // 'uint32'/'int32' cases) - identifies which Cast operands actually
      // need the POSIX::fmod-backed OpCodes::u32mask safe extraction
      // instead of a plain "& 0xFFFFFFFF": a value that never passed
      // through a forced-double multiply is a genuine Perl native integer
      // (IV/UV) no matter how large (e.g. Whirlpool's "~pos" bitwise
      // complement, or a 64-bit hi/lo split value) - native "&" is exact
      // for those, and routing them through u32mask's fmod would instead
      // *introduce* precision loss by forcing an unwanted IV/UV -> NV
      // round-trip on a value already exact at 64-bit width.
      result.isForcedDouble = true;
      return result;
    }

    /**
     * Recursively check whether a (post-transform) Perl expression subtree
     * contains a _forceDoubleMultiply result - see that method's doc
     * comment and the Cast/'uint32'/'int32' cases for why this gates which
     * extraction helper is safe to use. Generic own-property walk so it
     * doesn't need updating for every PerlNode subclass shape.
     * @param {*} node
     * @param {Set} [seen] - cycle guard
     * @returns {boolean}
     */
    _containsForcedDoubleMultiply(node, seen) {
      if (!node || typeof node !== 'object') return false;
      if (node.isForcedDouble) return true;
      seen = seen || new Set();
      if (seen.has(node)) return false;
      seen.add(node);
      for (const key of Object.keys(node)) {
        const val = node[key];
        if (Array.isArray(val)) {
          for (const item of val) {
            if (this._containsForcedDoubleMultiply(item, seen)) return true;
          }
        } else if (val && typeof val === 'object') {
          if (this._containsForcedDoubleMultiply(val, seen)) return true;
        }
      }
      return false;
    }

    /**
     * True if node is a JS numeric literal with a non-integer value (e.g.
     * `0.5`), used to keep the 64-bit-safe "+"/"-" rewrite (see
     * transformBinaryExpression/transformAssignmentExpression) from touching
     * genuine floating-point arithmetic.
     * @param {object} node
     * @returns {boolean}
     */
    _isFloatLiteralNode(node) {
      return !!node && node.type === 'Literal' && typeof node.value === 'number' && !Number.isInteger(node.value);
    }

    /**
     * True if node is a JS numeric literal already known to be in [0, 31] -
     * a shift count this small needs no runtime "& 31" mask (see the '<<'/
     * '>>'/'>>>' shift-count-masking cases in transformBinaryExpression):
     * masking would be a correctness no-op, so skipping it for the common
     * literal-shift-amount case (e.g. "x >>> 8") keeps the emitted code
     * exactly as before instead of adding dead "& 31" everywhere.
     * @param {object} node
     * @returns {boolean}
     */
    _isSmallShiftLiteral(node) {
      return !!node && node.type === 'Literal' && typeof node.value === 'number' &&
        Number.isInteger(node.value) && node.value >= 0 && node.value <= 31;
    }

    /**
     * Build a call to the OpCodes::u64add/u64sub runtime-stub helper (see
     * PerlEmitter.js emitOpCodesRuntimeStub) for a 64-bit-safe "+"/"-".
     * @param {'+'|'-'|'*'} operator
     * @param {PerlNode} left - already-transformed left operand
     * @param {PerlNode} right - already-transformed right operand
     * @returns {PerlCall}
     */
    _u64SafeArithCall(operator, left, right) {
      this.usesOpCodesRuntimeFallback = true;
      const helperName = operator === '+' ? 'u64add' : (operator === '-' ? 'u64sub' : 'u64mul');
      return new PerlCall(
        new PerlMemberAccess(new PerlIdentifier('OpCodes'), new PerlIdentifier(helperName), '::'),
        [left, right]
      );
    }

    /**
     * Shallow recursive scan of a raw (untransformed) JS/IL AST subtree for
     * an Identifier reference named `name` - used by the self-referential
     * shift-accumulate assignment check (see transformAssignmentExpression)
     * to tell apart e.g. random/lehmer64.js's byte-accumulate "stateValue =
     * (stateValue << 8) | stateBytes[i]" (right-hand side of '|' is an
     * independent small value - safe to route through exact-precision
     * Math::BigInt) from aead/oribatida.js's 62-bit round-constant rotate
     * "z = (z >> 1) | (z << 61)" (right-hand side of '|' is ANOTHER shift of
     * the very same self-referenced variable - a fixed-width rotate that
     * *wants* native 64-bit hardware wraparound, not unbounded growth).
     * @param {object} node - raw AST node/subtree
     * @param {string} name - identifier name to search for
     * @param {number} [depth] - recursion guard
     * @returns {boolean}
     */
    _referencesIdentifier(node, name, depth) {
      depth = depth || 0;
      if (!node || typeof node !== 'object' || depth > 20) return false;
      if (node.type === 'Identifier' && node.name === name) return true;
      for (const k in node) {
        if (k === 'parent') continue;
        const v = node[k];
        if (Array.isArray(v)) {
          for (const item of v) if (this._referencesIdentifier(item, name, depth + 1)) return true;
        } else if (v && typeof v === 'object' && this._referencesIdentifier(v, name, depth + 1)) {
          return true;
        }
      }
      return false;
    }

    /**
     * True if resultType is a positively-identified narrow (< 64-bit)
     * integer type - used to *exclude* a '%' operand from the exact-
     * precision Math::BigInt rewrite (see its call site's doc comment).
     * Deliberately the inverse of a "is this wide" check: an unresolved/
     * absent resultType (null/undefined, or any string not in this exact
     * list) is treated as *not* narrow (i.e. left eligible for the
     * exact-precision path), since the type-aware parser frequently can't
     * infer a resultType for a runtime-configurable `this.`-property, and
     * failing open there (instead of silently falling back to the lossy
     * u64 wraparound path) is what the real 64-bit-prime LCG family needs.
     * @param {string|null|undefined} resultType
     * @returns {boolean}
     */
    _isNarrowResultType(resultType) {
      return new Set(['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32']).has(resultType);
    }

    /**
     * Recursively rebuild a pure "+"/"-"/"*" expression tree (the dividend
     * of a "% modulus" in a BigInt-flagged file - see the '%'-of-'+'/'-'/'*'
     * case in transformBinaryExpression above) as exact-precision
     * Math::BigInt arithmetic, instead of the generic u64add/u64sub/u64mul
     * 64-bit-wraparound rewrite those operators normally get in a
     * BigInt-flagged file. Only wraps the single leftmost leaf in
     * "Math::BigInt->new(...)"; every other node along the way is emitted
     * as Perl's own "+"/"-"/"*", which Math::BigInt's operator overloading
     * automatically upgrades to exact arbitrary-precision arithmetic once
     * the left operand it's applied to is (or descends from) a blessed
     * Math::BigInt object - covering not just "(a * b) % m" but also
     * "(a * b + c) % m" (e.g. random/combined-lcg.js's explicit-modulus
     * LCG branch: "state128 = state * multiplier + increment; state =
     * state128 % modulus"), without needing to enumerate every possible
     * shape of the dividend expression.
     * @param {object} node - raw (untransformed) JS AST node
     * @returns {PerlNode}
     */
    _buildExactBigIntExpr(node) {
      if (node && node.type === 'BinaryExpression' &&
          (node.operator === '+' || node.operator === '-' || node.operator === '*')) {
        const left = this._buildExactBigIntExpr(node.left);
        // Group the right operand too, not just the recursed left side -
        // e.g. block/ff.js's BigIntegerUtils.fromByteArray byte-accumulate
        // "result = OpCodes.ShiftLn(result, 8) + BigInt(bytes[i]&0xFF)":
        // the right operand is itself a lower-precedence "&" expression
        // (bytes[i] & 0xFF). Perl's "&" binds LOOSER than "+", so an
        // ungrouped "(bigShiftedResult) + $bytes->[$i] & 255" parses as
        // "((bigShiftedResult) + $bytes->[$i]) & 255" - masking the WHOLE
        // accumulator down to a single byte every iteration instead of
        // masking only the newly-appended byte, exactly the reverse of
        // the source's explicit "BigInt(bytes[i]&0xFF)" parenthesization.
        // Always grouping (even when unnecessary, e.g. a bare literal/
        // identifier right operand) costs nothing beyond a redundant pair
        // of parens.
        const right = new PerlGrouped(this.transformExpression(node.right));
        return new PerlBinaryExpression(new PerlGrouped(left), node.operator, right);
      }
      // "x << k" / "x >> k" - recurse into the shifted operand (so a chain of
      // shifts, not just a single one, also stays exact) and emit via
      // Math::BigInt's blsft/brsft rather than Perl's native "<<"/">>" (which
      // silently truncates/is undefined behavior past the platform's native
      // integer width) - see transformAssignmentExpression's self-referential
      // shift-accumulate case, which is the other caller of this helper.
      if (node && node.type === 'BinaryExpression' &&
          (node.operator === '<<' || node.operator === '>>')) {
        const base = this._buildExactBigIntExpr(node.left);
        const amount = this.transformExpression(node.right);
        const method = node.operator === '<<' ? 'blsft' : 'brsft';
        return new PerlRawCode(`(${base})->${method}(${amount})`);
      }
      // Bitwise "|" - the byte-accumulate half of the self-referential
      // shift-accumulate assignment case ("x = (x << k) | y" - see its doc
      // comment), via Math::BigInt's explicit bior() method rather than
      // relying on "|" operator overloading.
      if (node && node.type === 'BinaryExpression' && node.operator === '|') {
        const left = this._buildExactBigIntExpr(node.left);
        const right = this.transformExpression(node.right);
        return new PerlRawCode(`(${left})->bior(${right})`);
      }
      return new PerlRawCode(`Math::BigInt->new(${this.transformExpression(node)})`);
    }

    /**
     * Transform a unary expression
     */
    transformUnaryExpression(node) {
      let operator = node.operator;

      // Handle typeof specially before transforming operand
      if (operator === 'typeof') {
        // For known package names (OpCodes, Math, etc.), typeof returns 'object' (always defined)
        if (node.argument.type === 'Identifier') {
          const name = node.argument.name;
          const knownPackages = new Set([
            'OpCodes', 'Math', 'JSON', 'console', 'Object', 'Array', 'String', 'Number',
            'Uint8Array', 'Int8Array', 'Uint16Array', 'Int16Array', 'Uint32Array', 'Int32Array',
            'Float32Array', 'Float64Array', 'ArrayBuffer', 'DataView',
            'AlgorithmFramework', 'RegisterAlgorithm', 'CategoryType', 'SecurityStatus',
            'ComplexityType', 'CountryCode', 'LinkItem', 'KeySize', 'TestCase', 'Vulnerability'
          ]);
          if (knownPackages.has(name)) {
            // typeof KnownPackage returns 'object' (always defined)
            return PerlLiteral.String('object', "'");
          }

          // JavaScript globals that don't exist in Perl - return 'undefined'.
          // Includes CommonJS's own "require" - most "typeof require !==
          // 'undefined'" module-loader guards are stripped away entirely
          // before reaching here (see type-aware-transpiler.js's
          // _stripRequireGuardedBlocks), but a few survive inside a
          // method body rather than the top-level UMD wrapper (e.g.
          // stream/xchacha20.js's generateNonce()'s Node crypto.randomBytes
          // fallback) - those fell through to the "regular variables" path
          // below, emitting "ref($require)" on a never-declared bareword
          // Perl variable ("Global symbol $require requires explicit
          // package name"). Resolving to always-'undefined' correctly
          // skips that Node-only branch, which is the right outcome for
          // deterministic test-vector execution anyway (whatever
          // OpCodes-backed fallback follows is what actually runs).
          const jsGlobals = new Set([
            'TextEncoder', 'TextDecoder', 'Buffer', 'Crypto', 'crypto',
            'window', 'document', 'navigator', 'performance',
            'global', 'globalThis', 'self', 'process', 'require'
          ]);
          if (jsGlobals.has(name)) {
            // These don't exist in Perl, so typeof returns 'undefined'
            return PerlLiteral.String('undefined', "'");
          }
        }

        // For regular variables, use ref()
        const operand = this.transformExpression(node.argument);
        return new PerlCall(new PerlIdentifier('ref'), [operand]);
      }

      // "!<X>Module.PropName" - the "module loaded"/"export present" sanity
      // guard commonly paired with the "<X>Module.PropName" UMD-dependency-
      // export pattern (see transformMemberExpression's matching comment;
      // e.g. mac/cbcmac.js's "if (!DESModule || !DESModule.DESAlgorithm)
      // throw ...").  That MemberExpression already resolves to a bare
      // "DESAlgorithm" class-name identifier (the dependency's classes are
      // bundled directly at the top level in standalone Perl output), which
      // has no meaningful truthiness of its own outside a "->"/"new"
      // context - negating it as a bareword dies "Bareword ... not allowed
      // while strict subs in use". The dependency's presence is guaranteed
      // by successful compilation once bundled, so the check is always
      // false post-bundling (mirrors the existing "!AlgorithmFramework"/
      // "!OpCodes" always-false handling via their isClassName string-
      // literal form - this pattern only differs in going through a
      // MemberExpression instead of a bare Identifier).
      if (operator === '!' && node.argument.type === 'MemberExpression' && this._isUmdDependencyModuleAccess(node.argument)) {
        return PerlLiteral.Number(0);
      }

      const operand = this.transformExpression(node.argument);

      if (operator === '!') operator = '!';

      // JS "~x" is a 32-bit bitwise NOT (operand is first ToInt32-coerced,
      // producing a 32-bit two's-complement result) - Perl's "~" instead
      // complements the scalar's full native integer width (typically 64
      // bits), so e.g. ~0x67452301 comes out as 0xFFFFFFFF98BDACFE instead
      // of the 32-bit 0x98BDACFE. Left unmasked, this silently corrupts any
      // ~x used in further bit ops (Ch/Maj-style functions in SHA-1/MD5/etc,
      // any "& ~mask" clearing idiom). Mask down to 32 bits to match JS -
      // UNLESS the operand is actually a 64-bit/BigInt value (e.g. "~e" on a
      // SHA-512/Tiger/Skein round-state word), in which case JS's "~" is
      // BigInt's arbitrary-precision two's complement (-x-1), not a 32-bit
      // truncation - masking that down to 32 bits would zero out the high
      // 32 bits every such value depends on. The shared type-aware parser
      // only reliably tags genuinely-narrow operands as uint16/uint32/int32
      // (e.g. via And32/Xor8-style explicit masks); a plain uninitialized-
      // then-reassigned local (e.g. SHA-512/Skein's "let a, b, c, d, e, f, g,
      // h;" compression-loop registers, which hold full 64-bit round state)
      // gets no useful type from the shared parser and falls back to its
      // untyped default of 'uint8', indistinguishable node-locally from a
      // genuine byte value - so treat that ambiguous default as wide too,
      // inside a file that uses BigInt literals anywhere (in this codebase,
      // never a mix of real byte-level `~` and BigInt state in the same
      // file) - see _scanForBigIntLiterals()'s doc comment and
      // PythonTransformer.js's identical isWideIntResultType() heuristic.
      if (operator === '~') {
        const NARROW_RESULT_TYPES = new Set(['int8', 'uint16', 'int16', 'uint32', 'int32']);
        const WIDE_RESULT_TYPES = new Set(['bigint', 'uint64', 'int64', 'qword']);
        const argResultType = node.argument && node.argument.resultType;
        const isWide = WIDE_RESULT_TYPES.has(argResultType) ||
          (this._fileHasBigIntLiterals && !NARROW_RESULT_TYPES.has(argResultType));

        // Genuinely-128-bit operand (e.g. block/present.js's PRESENT-128
        // key-schedule bit-clearing mask "~OpCodes.ShiftLn(0xFn, 120n)",
        // clearing 4 bits near the top of a 128-bit key state) - detected
        // via the same "shift by a literal amount >= 65" signal the '<<'
        // case above uses to route ShiftLn itself through Math::BigInt
        // (operand, built by transformExpression just above, is already
        // that blessed Math::BigInt result). JS BigInt "~" is arbitrary-
        // precision two's complement; masking it down to 64 bits (the
        // isWide branch below) would permanently clear bits 64-127 of
        // whatever this result is ANDed against next - PRESENT-128's key
        // state depends on exactly those bits. Computed as "allOnes128 XOR
        // operand" (equivalent to "~operand" for any operand already known
        // to be within [0, 2**128), which it always is here) rather than
        // relying on Math::BigInt's own unary complement (undefined/
        // meaningless without a fixed width to complement over).
        const argShiftAmount = (node.argument && node.argument.type === 'BinaryExpression' && node.argument.operator === '<<')
          ? this._literalNumberValue(node.argument.right) : null;
        if (isWide && typeof argShiftAmount === 'number' && argShiftAmount >= 65) {
          this.addRequiredModule('Math::BigInt');
          return new PerlRawCode(`(Math::BigInt->new(1)->blsft(128)->bsub(1))->bxor(${operand})`);
        }

        return new PerlBinaryExpression(
          new PerlGrouped(new PerlUnaryExpression(operator, operand)),
          '&',
          isWide ? PerlLiteral.Number(0xFFFFFFFFFFFFFFFFn) : PerlLiteral.Number(0xFFFFFFFF)
        );
      }

      return new PerlUnaryExpression(operator, operand);
    }

    /**
     * Transform an assignment expression
     */
    transformAssignmentExpression(node) {
      // Track if a plain "x = <string-expr>;" reassignment (as opposed to
      // transformLetStatement's declare-with-initializer case) makes a
      // local variable structurally a string, so later Identifier
      // references (isStringType) recognize it too - e.g. classical/
      // railfence.js's "let result; if (...) result = this.decryptRailFence(
      // ...); else result = this.encryptRailFence(...); ...
      // result.length" (both branches return strings, but "let result;" has
      // no initializer for transformLetStatement to see). Without this,
      // "result.length" fell through ArrayLength's array-length default
      // (scalar(@$result)), dying "Can't use string ... as an ARRAY ref"
      // since $result is a plain string, not a reference.
      if (node.operator === '=' && node.left.type === 'Identifier') {
        if (this.isStringType(node.right))
          this.stringVariables.add(node.left.name);
        else
          this.stringVariables.delete(node.left.name);
      }

      // "global.X = value" / "globalThis.X = value" / "window.X = value" /
      // "self.X = value" - e.g. stream/xchacha20.js's trailing "global.
      // XChaCha20 = XChaCha20;" (an export-style side-assignment onto the
      // host global object, irrelevant to this harness's own RegisterAlgorithm
      // -based dispatch). transformMemberExpression resolves a bare "global"/
      // "window"/... read to a literal `undef` (see its own doc comment), which
      // is fine as an rvalue but not a valid assignment TARGET - "undef->{'X'}
      // = value" dies "Can't use an undefined value as a HASH reference" the
      // same way an unguarded *read* of one used to. There is no real
      // storage this assignment could write into (there's no genuine "global"
      // object in the generated Perl), so - mirroring JS's own semantics
      // where this write is simply never observed by anything the harness
      // touches - reduce the statement to evaluating the right-hand side
      // alone (preserving any real side effects it has) and discard the
      // assignment itself.
      if (node.operator === '=' && node.left.type === 'MemberExpression' &&
          node.left.object?.type === 'Identifier' &&
          ['global', 'globalThis', 'window', 'self'].includes(node.left.object.name) &&
          !this.variableTypes.has(node.left.object.name)) {
        return this.transformExpression(node.right);
      }

      // Handle plain assignment to a get/set accessor-backed this.property
      // (key, iv, nonce, ...): must route through the setter method rather
      // than clobbering a raw hash key, mirroring the ThisPropertyAccess
      // read-side handling in transformExpression.
      // this.key = value -> $self->key(value)
      //
      // Also handles the same accessor-property write when the receiver is
      // some OTHER local variable of the *same* (or a base) class - the
      // recursive-construction idiom "const tempInstance = new
      // <SameClass>(...); tempInstance.level = ...;" (see
      // algorithms/ecc/plotkin-code.js's encode()/decode(), which recurse by
      // constructing a fresh instance of themselves). _isAccessorProperty()
      // normally only sees this.currentClass (relevant for `this.x = `), so
      // without this, "tempInstance.level = N" silently emitted a raw
      // "$tempInstance->{'level'} = N" hash-field write instead of calling
      // the "level" setter sub - the setter's real target field (_level)
      // never got updated, so every recursive call kept using whatever
      // level the instance happened to default to. The type-aware parser
      // already resolves the variable's class via static inference
      // (VariableDeclarator/Identifier .resultType, e.g. "Foo" for "const
      // tempInstance = new Foo(...)"), so classAccessors (keyed by class
      // name) can be consulted directly for that class instead of assuming
      // "this".
      if (node.operator === '=') {
        const isThisProp = node.left.type === 'ThisPropertyAccess' ||
          (node.left.type === 'MemberExpression' && node.left.object?.type === 'ThisExpression');
        let accessorSelfExpr = null;
        let accessorClassName = null;
        if (isThisProp) {
          accessorSelfExpr = new PerlIdentifier('self', '$');
          accessorClassName = this.currentClass?.name;
        } else if (node.left.type === 'MemberExpression' && !node.left.computed &&
            node.left.object?.type === 'Identifier') {
          const varClassName = node.left.object.resultType;
          if (varClassName && this.classAccessors.has(varClassName)) {
            accessorClassName = varClassName;
            accessorSelfExpr = this.transformExpression(node.left.object);
          }
        }
        if (accessorClassName) {
          const propName = node.left.property?.name || node.left.property?.value ||
            (typeof node.left.property === 'string' ? node.left.property : null);
          if (propName && this._isAccessorProperty(propName, accessorClassName)) {
            const rightExpr = this.transformExpression(node.right);
            return new PerlMemberAccess(
              accessorSelfExpr,
              new PerlCall(new PerlIdentifier(propName), [rightExpr]),
              '->'
            );
          }
        }
      }

      // Handle array.length = N assignment specially (IL transformed version)
      // The IL transformer converts arr.length to ArrayLength node
      // JavaScript: arr.length = 0 clears the array
      // JavaScript: arr.length = N truncates or extends with undefined
      // Perl: @arr = () to clear, or splice(@arr, N) to truncate
      if (node.left.type === 'ArrayLength' || node.left.ilNodeType === 'ArrayLength') {
        const arrExpr = this.transformExpression(node.left.array);
        const lengthVal = this.transformExpression(node.right);

        // If assigning 0 (Literal or NumberLiteral), clear the array: @{$arr} = ()
        if ((node.right.type === 'Literal' || node.right.type === 'NumberLiteral') &&
            node.right.value === 0) {
          return new PerlAssignment(
            this.wrapArrayDeref(arrExpr),
            '=',
            new PerlList([])  // Empty list ()
          );
        }

        // Otherwise use splice to truncate: splice(@{$arr}, $length)
        return new PerlCall('splice', [
          this.wrapArrayDeref(arrExpr),
          lengthVal
        ]);
      }

      // Handle array.length = N assignment specially (original MemberExpression version)
      // Fallback for non-IL transformed code
      if (node.left.type === 'MemberExpression' &&
          !node.left.computed &&
          (node.left.property.name === 'length' || node.left.property.value === 'length')) {
        const arrExpr = this.transformExpression(node.left.object);
        const lengthVal = this.transformExpression(node.right);

        // If assigning 0, clear the array: @{$arr} = ()
        if (node.right.type === 'Literal' && node.right.value === 0) {
          return new PerlAssignment(
            this.wrapArrayDeref(arrExpr),
            '=',
            new PerlList([])  // Empty list ()
          );
        }

        // Otherwise use splice to truncate: splice(@{$arr}, $length)
        return new PerlCall('splice', [
          this.wrapArrayDeref(arrExpr),
          lengthVal
        ]);
      }

      // Handle object destructuring assignment: { a: target1, b: target2 } = func()
      // JavaScript: ({ a: v[0], b: v[4] } = result)
      // Perl: do { my $_tmp = result; v->[0] = $_tmp->{'a'}; v->[4] = $_tmp->{'b'}; }
      // Note: In assignment context, parser may give ObjectExpression, ObjectPattern, or ObjectLiteral (from IL AST)
      if (node.left.type === 'ObjectPattern' || node.left.type === 'ObjectExpression' ||
          node.left.type === 'ObjectLiteral' || node.left.ilNodeType === 'ObjectLiteral') {
        const properties = node.left.properties || [];
        const rightExpr = this.transformExpression(node.right);

        // Create a do block that: 1) saves result, 2) assigns each property
        const statements = [];
        const tmpVar = new PerlIdentifier('_destr_tmp', '$');

        // my $_destr_tmp = <right>;
        statements.push(new PerlVarDeclaration('my', '_destr_tmp', '$', rightExpr));

        // For each property: target = $_destr_tmp->{'key'};
        for (const prop of properties) {
          // In destructuring { a: v[0] }, key='a', value=v[0] (the target).
          // The shared IL builder represents an ObjectProperty's key as a
          // PLAIN STRING directly (see e.g. hash/blake.js's renamed-
          // destructuring "({ a: v[0], b: v[4], c: v[8], d: v[12] } =
          // G1s_32(...))": prop.key is the bare string "b", not a nested
          // {name}/{value} node) - "prop.key.name || prop.key.value" on a
          // plain string is always undefined (strings have neither
          // property), so `key` silently became the literal string
          // "undefined" for EVERY property here, and every subsequent
          // "$_destr_tmp->{'undefined'}" read a hash key that never
          // existed - permanently undef, corrupting every destructured
          // target the moment this idiom ran. Same shape already handled
          // correctly elsewhere in this file (e.g. _isLengthPropertyAccess-
          // style helpers) via this exact "typeof key === 'string'" guard.
          const key = typeof prop.key === 'string' ? prop.key : (prop.key.name || prop.key.value);
          const target = this.transformExpression(prop.value);
          const access = new PerlSubscript(tmpVar, PerlLiteral.String(key, "'"), 'hash');
          statements.push(new PerlExpressionStatement(
            new PerlAssignment(target, '=', access)
          ));
        }

        // Return do block
        return new PerlCall('do', [new PerlBlock(statements)]);
      }

      // Handle array destructuring assignment: [a, b] = func()
      // JavaScript: [x0, x1] = someFunction();
      // Perl: ($x0, $x1) = @{someFunction()};
      // Note: In assignment context, parser may give ArrayExpression instead of ArrayPattern
      if (node.left.type === 'ArrayPattern' || node.left.type === 'ArrayExpression') {
        const elements = node.left.elements
          .filter(e => e !== null)
          .map(e => this.transformExpression(e));
        const leftList = new PerlList(elements);
        const rightExpr = this.transformExpression(node.right);
        // Dereference the right side as an array
        const rightDeref = new PerlUnaryExpression('@', rightExpr, true);
        return new PerlAssignment(leftList, '=', rightDeref);
      }

      // Plain assignment to a well-known Instance-interface property (key,
      // customization, outputSize, ...) on a sub-instance obtained via
      // CreateInstance() - e.g. "decryptCipher.key = this.blockCipher.key;"
      // in a mode-of-operation's Feed/Result, or "this.cshake.customization
      // = this._customization;" in hash/tuplehash.js's/parallelhash.js's
      // TupleHash/ParallelHash-over-cSHAKE composition. That property is
      // backed by a get/set accessor pair defined in whatever file the
      // sub-instance's class lives in, invisible to _isAccessorProperty()
      // here since it only knows about classes transformed within this same
      // file - see _isCipherInstanceRef() and CROSS_INSTANCE_ACCESSOR_PROPS'
      // doc comments. Gated on the well-known-name allowlist (not every
      // property on such an object) since a genuine plain data field
      // (unlikely but not impossible) would need real hash-key semantics.
      if (node.operator === '=' && node.left.type === 'MemberExpression' &&
          !node.left.computed) {
        const propName = node.left.property?.name || node.left.property?.value;
        if (CROSS_INSTANCE_ACCESSOR_PROPS.has(propName) && this._isCipherInstanceRef(node.left.object)) {
          const objExpr = this.transformExpression(node.left.object);
          const rightExpr = this.transformExpression(node.right);
          return new PerlMemberAccess(
            objExpr,
            new PerlCall(new PerlIdentifier(propName), [rightExpr]),
            '->'
          );
        }
      }

      // Assignment to a class's own static field - "ClassName.field = value"
      // (e.g. block/ice.js's "IceCore.spBox = [];"/"IceCore.spBoxInitialized
      // = true;" inside a static-initialization method). This must resolve
      // to the SAME "$ClassName::field" Perl package variable the read side
      // (transformMemberExpression's isClassObj/_isClassStaticField branch)
      // already uses for "IceCore.spBox" reads - falling through to the
      // generic non-this-property hash-write branch just below instead
      // turned the class-name identifier into a bareword/quoted-string
      // object ("'IceCore'->{'spBox'} = ...") which Perl's parser resolves
      // as a SYMBOLIC reference to the package hash %IceCore for the
      // "->{...}" (as opposed to "->method(...)") form - a hash that's
      // never declared anywhere, dying at compile time with "Global symbol
      // %IceCore requires explicit package name".
      if (node.operator === '=' && node.left.type === 'MemberExpression' &&
          !node.left.computed && node.left.object?.type === 'Identifier' &&
          this._isClassObjName(node.left.object.name)) {
        const member = node.left.property?.name || node.left.property?.value;
        if (this._isClassStaticField(member)) {
          const rightExpr = this.transformExpression(node.right);
          return new PerlAssignment(
            new PerlRawCode(`$${node.left.object.name}::${member}`),
            '=',
            rightExpr
          );
        }
      }

      // Plain assignment to a non-computed property of some OTHER (non-this)
      // object - e.g. "this.tests[0].key = bytes;" where tests[0] is a
      // TestCase instance. JS property assignment is always a data write
      // here (none of the plain data/metadata classes like TestCase,
      // LinkItem, KeySize define setters), but transformMemberExpression's
      // generic read path defaults unknown property names to method-call
      // style ($obj->key) for the (much more common) method-invocation
      // case. Assignment context is unambiguous, so always use a hash
      // write here regardless of that heuristic.
      if (node.operator === '=' && node.left.type === 'MemberExpression' &&
          !node.left.computed && node.left.object?.type !== 'ThisExpression') {
        const propName = node.left.property?.name || node.left.property?.value;
        if (propName && propName !== 'length') {
          const objExpr = this.transformExpression(node.left.object);
          const rightExpr = this.transformExpression(node.right);
          return new PerlAssignment(
            new PerlSubscript(objExpr, PerlLiteral.String(propName, "'"), 'hash', true),
            '=',
            rightExpr
          );
        }
      }

      // Self-referential shift-accumulate assignment "x = (x << k) + y" (or
      // "x = (x >> k) - y") in a BigInt-flagged file - e.g. mac/poly1305.js's
      // bytesToNum "num = OpCodes.ShiftLn(num, BigInt(8)) + BigInt(bytes[i])"
      // inside a per-byte loop (the shared IL builder reduces
      // OpCodes.ShiftLn/ShiftRn to a plain '<<'/'>>' BinaryExpression before
      // this transformer ever sees it - see the '<<' shiftAmount>=64 case in
      // transformBinaryExpression). Building a value up 8 bits at a time
      // across many loop iterations grows past 64 significant bits over the
      // course of the loop even though no single shift amount is ever >= 64 -
      // the existing "shiftAmount >= 64" heuristic for a lone literal '<<'
      // therefore never fires here, and the generic '+'/'-' rule for a
      // BigInt-flagged file (u64add/u64sub, exact only up to 64 bits inside a
      // `use integer` block - see transformBinaryExpression's doc comment)
      // silently truncates the accumulator the moment it exceeds 64 bits,
      // unlike JS BigInt (exact at any size) - poly1305's 17-byte block (16
      // data bytes plus one padding bit) needs up to 136 bits. Detected
      // structurally by the assignment target reappearing as the immediate
      // left operand of a nested '<<'/'>>' on the right-hand side -
      // deliberately NOT the same shape as the 64-bit-wraparound-wanted
      // rotate idiom "(v << k | v >> (64-k)) & mask64" (top-level '|',
      // always followed by an explicit mask; this pattern's top-level
      // operator is '+'/'-' with no surrounding mask), so it doesn't regress
      // that already-correct rotate family. Routed through
      // _buildExactBigIntExpr (shared with the '%'-of-'+'/'-'/'*' case above,
      // now also handling '<<'/'>>' via blsft/brsft) so the whole chain
      // becomes exact-precision Math::BigInt arithmetic.
      // Unwrap a "BigInt(x)" cast node (the IL's BigIntCast wrapper, e.g.
      // around the self-referenced "num" in "OpCodes.ShiftLn(BigInt(num),
      // ...)")  down to the underlying expression, so the structural check
      // below sees through it.
      // '|' is ALSO eligible (e.g. random/lehmer64.js's byte-accumulate
      // "stateValue = OpCodes.OrN(OpCodes.ShiftLn(stateValue, 8),
      // BigInt(stateBytes[i]))", building a 128-bit state 8 bits at a time)
      // - but ONLY when the right-hand OPERAND of that '|' does NOT itself
      // reference the assigned variable, which is what distinguishes this
      // accumulate idiom from the fixed-width rotate idiom "z = (z >> k1) |
      // (z << k2)" (e.g. aead/oribatida.js's round-constant rotation, which
      // *wants* native 64-bit hardware wraparound, not unbounded growth -
      // see _referencesIdentifier's doc comment).
      // A "*" by a power-of-two literal is the same accumulate idiom spelled
      // as a multiply instead of a shift - e.g. block/present.js's 80-bit-
      // key-from-bytes packing "key = key * BigInt(256) + byteValue" (10
      // iterations of *256 = *2^8, growing to 80 significant bits, exactly
      // the same shape as poly1305's "(num << 8) + bytes[i]" above, just
      // multiplying by 2^8 instead of shifting by 8). Recognized
      // structurally alongside '<<'/'>>' so this same exact-precision path
      // (and its provably-safe-bound guard) covers both spellings.
      const _unwrapBigIntCast = n => (n && n.type === 'BigIntCast') ? _unwrapBigIntCast(n.argument) : n;
      const _shiftBase = node.right && node.right.type === 'BinaryExpression' &&
        (node.right.operator === '+' || node.right.operator === '-' || node.right.operator === '|') &&
        node.right.left && node.right.left.type === 'BinaryExpression' &&
        (node.right.left.operator === '<<' || node.right.left.operator === '>>' || node.right.left.operator === '*') ?
        _unwrapBigIntCast(node.right.left.left) : null;
      // Skip the exact-precision rewrite when the innermost enclosing for-
      // loop's statically-estimated max iteration count, times this shift's
      // literal amount, provably never exceeds 64 bits (see
      // _estimateForLoopBound's doc comment) - e.g. hash/sha512.js's
      // message-schedule word-from-bytes packing ("for (let i = 0; i < 8;
      // ++i) value = (value<<8)|byte;", exactly 8*8 = 64 bits) fits a
      // native Perl integer exactly and doesn't need (and, being called
      // per-block inside a hash function's hot inner loop, really can't
      // afford the object-allocation overhead of) Math::BigInt at all.
      // Unknown/unbounded loops (null) fail closed (still routed through
      // Math::BigInt) - only a POSITIVELY proven-safe bound skips it.
      const _loopBound = this._loopBoundStack.length ? this._loopBoundStack[this._loopBoundStack.length - 1] : null;
      // For the '*' spelling, the "shift amount" equivalent is log2 of the
      // literal multiplier (e.g. *256 == <<8); a non-power-of-two multiplier
      // can't be expressed as an equivalent bit-shift width, so it's left
      // null (fails closed - the provably-safe check below requires a
      // number, so a null amount always routes through the exact-precision
      // path rather than risking a wrong "safe" guess).
      const _mulLiteral = (_shiftBase && node.right.left.operator === '*') ? this._literalNumberValue(node.right.left.right) : null;
      const _mulShiftEquiv = (typeof _mulLiteral === 'number' && _mulLiteral > 0 && Number.isInteger(Math.log2(_mulLiteral))) ? Math.log2(_mulLiteral) : null;
      const _shiftLiteralAmount = _shiftBase ? (node.right.left.operator === '*' ? _mulShiftEquiv : this._literalNumberValue(node.right.left.right)) : null;
      const _provablySafe = !this._fileUsesBigIntPow && typeof _loopBound === 'number' && typeof _shiftLiteralAmount === 'number' &&
        _loopBound * _shiftLiteralAmount <= 64;
      if (node.operator === '=' && node.left.type === 'Identifier' && this._fileHasBigIntLiterals &&
          _shiftBase && _shiftBase.type === 'Identifier' && _shiftBase.name === node.left.name &&
          (node.right.operator !== '|' || !this._referencesIdentifier(node.right.right, node.left.name)) &&
          !_provablySafe) {
        this.addRequiredModule('Math::BigInt');
        const leftExpr = this.transformExpression(node.left);
        const exact = this._buildExactBigIntExpr(node.right);
        return new PerlAssignment(leftExpr, '=', new PerlRawCode(`(${exact})`));
      }

      // Self-referential division-accumulate assignment "x = x / y" in a
      // BigInt-flagged file - e.g. block/ff.js's FF1 RadixConverter's
      // "toEncoding" digit-extraction loop ("value = value /
      // this.bigRadix" inside a "for (i = length-1; i >= 0; i--)" loop,
      // alongside "output[i] = value % this.bigRadix"). The generic '/'
      // rule for a BigInt-flagged file (see transformBinaryExpression's
      // '/' case) routes through OpCodes::u64div, which - so the LCG
      // family's "quotient === 0n" checks that rule targets keep getting a
      // plain scalar back - returns a bstr()'d decimal STRING rather than
      // a blessed Math::BigInt object. That's fine for a single division,
      // but toEncoding's value can be far larger than 64 bits (radix**
      // length, e.g. 36**19) and needs to survive MANY repeated divisions:
      // once degraded to a plain string after the first iteration, the
      // very next iteration's "value % this.bigRadix" runs as Perl's
      // native "%", silently numifying a many-digit string through a
      // (precision-losing) floating-point NV before computing the
      // modulus. Keeping the self-referenced value blessed (never
      // touching bstr()) across every iteration avoids that: a blessed
      // Math::BigInt's own overloaded "%"/"/" stay exact regardless of
      // how many times the loop runs.
      if (node.operator === '=' && node.left.type === 'Identifier' && this._fileHasBigIntLiterals &&
          node.right && node.right.type === 'BinaryExpression' && node.right.operator === '/' &&
          node.right.left && node.right.left.type === 'Identifier' && node.right.left.name === node.left.name) {
        this.addRequiredModule('Math::BigInt');
        const leftExpr = this.transformExpression(node.left);
        const divisor = this.transformExpression(node.right.right);
        return new PerlAssignment(leftExpr, '=', new PerlRawCode(`Math::BigInt->new("${leftExpr}")->bdiv(${divisor})`));
      }

      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);

      // Map compound assignments
      let operator = node.operator;
      if (operator === '+=' && this.isStringContext(node.left, node.right)) {
        operator = '.=';  // String concatenation assignment
      }

      // Handle unsigned right shift assignment (>>>=)
      // JavaScript: x >>>= n is equivalent to x = (x >>> n)
      // Perl: x = ((x >> n) & ((1 << (32 - n)) - 1))  for 32-bit unsigned
      // Simpler: $x = ($x >> $n) & 0xFFFFFFFF  (mask to 32-bit unsigned)
      if (operator === '>>>=') {
        // Convert to: $left = ($left >> $right) & 0xFFFFFFFF
        // Note: PerlBinaryExpression constructor is (left, operator, right)
        // Note: PerlLiteral.Hex expects a numeric value, not a string
        const shiftExpr = new PerlBinaryExpression(left, '>>', right);
        const maskedExpr = new PerlBinaryExpression(shiftExpr, '&', PerlLiteral.Hex(0xFFFFFFFF));
        return new PerlAssignment(left, '=', maskedExpr);
      }

      // "+="/"-=" need the same 64-bit-safe treatment as plain "+"/"-" (see
      // the long comment in transformBinaryExpression) - this is the common
      // form for 64-bit hash/PRNG round state (e.g. Skein's "b0 += b1",
      // deliberately left unmasked by the source until a later helper call
      // masks it - JS BigInt tolerates that because it never loses
      // precision; Perl's native "+=" would silently float-promote and
      // permanently corrupt the low bits first).
      if ((operator === '+=' || operator === '-=' || operator === '*=') && this._fileHasBigIntLiterals &&
          !this._isFloatLiteralNode(node.right)) {
        const baseOp = operator === '+=' ? '+' : (operator === '-=' ? '-' : '*');
        const call = this._u64SafeArithCall(baseOp, left, right);
        return new PerlAssignment(left, '=', call);
      }

      return new PerlAssignment(left, operator, right);
    }

    /**
     * Transform an update expression (++, --)
     */
    transformUpdateExpression(node) {
      const operand = this.transformExpression(node.argument);

      // Perl has ++ and --, same as JavaScript
      const op = node.operator === '++' ? '++' : '--';
      return new PerlUnaryExpression(op, operand, node.prefix);
    }

    /**
     * Transform a member expression
     */
    transformMemberExpression(node) {
      // Handle global.X and globalThis.X patterns
      if (node.object.type === 'Identifier') {
        const objectName = node.object.name;
        const member = node.property.name || node.property.value;

        // global.OpCodes and globalThis.OpCodes - always truthy in transpiled code
        if ((objectName === 'global' || objectName === 'globalThis') && member === 'OpCodes')
          return PerlLiteral.Number(1);

        // global.AlgorithmFramework and globalThis.AlgorithmFramework
        // The framework is always available, return the identifier
        if ((objectName === 'global' || objectName === 'globalThis') && member === 'AlgorithmFramework')
          return new PerlIdentifier('AlgorithmFramework');

        // Any OTHER global.X / globalThis.X / window.X / self.X single-level
        // property read (not the OpCodes/AlgorithmFramework escape hatches
        // just above) - e.g. stream/xchacha20.js's "global.CipherMetadata"
        // (a leftover optional integration point never wired up in this
        // codebase, always undefined at runtime, used only as a truthy
        // guard: "global.CipherMetadata ? global.CipherMetadata.foo(...) :
        // undefined"). transformIdentifier resolves the bare "global"/
        // "window"/... identifier itself to a literal `undef` (see its own
        // doc comment), so falling through to the generic MemberExpression
        // handling below would wrap this property read as "->{...}" around
        // that literal - dereferencing the bare `undef` KEYWORD (unlike a
        // variable that merely *holds* undef, which Perl derefs leniently
        // in rvalue context) dies "Can't use an undefined value as a HASH
        // reference" the instant this expression is evaluated at all - even
        // just as a ternary's CONDITION, before either branch is selected -
        // whereas JS's "global.CipherMetadata" quietly evaluates to
        // undefined. Collapsing the whole read to a literal `undef`
        // (matching its actual JS value) avoids ever performing that
        // dereference. Safe to resolve at any nesting depth a caller
        // chains off of it (e.g. the guarded branch's own deeper
        // "global.CipherMetadata.SecurityStatus.SECURE"): once the guard
        // itself no longer dies, Perl's own lazy ternary evaluation never
        // reaches that deeper (still `undef`-rooted, still only reachable
        // through the same always-false guard) chain at runtime, exactly
        // mirroring JS's short-circuit.
        if ((objectName === 'global' || objectName === 'globalThis' ||
             objectName === 'window' || objectName === 'self') &&
            !this.variableTypes.has(objectName))
          return PerlLiteral.Undef();
      }

      // Handle global.AlgorithmFramework.X.Y patterns - treat as AlgorithmFramework.X.Y
      // e.g., global.AlgorithmFramework.CategoryType.BLOCK -> 'block'
      if (node.object.type === 'MemberExpression' &&
          node.object.object.type === 'MemberExpression') {
        const root = node.object.object.object;
        if (root && root.type === 'Identifier' && (root.name === 'global' || root.name === 'globalThis')) {
          const middle = node.object.object.property.name || node.object.object.property.value;
          if (middle === 'AlgorithmFramework') {
            // This is global.AlgorithmFramework.X.Y - handle like AlgorithmFramework.X.Y
            const enumClass = node.object.property.name || node.object.property.value;
            const enumValue = node.property.name || node.property.value;
            const ENUM_CLASSES = new Set(['CategoryType', 'SecurityStatus', 'ComplexityType', 'CountryCode']);
            if (ENUM_CLASSES.has(enumClass))
              return PerlLiteral.String(enumValue.toLowerCase(), "'");
            // For other like LinkItem, Vulnerability, return the class name
            return new PerlIdentifier(enumClass);
          }
        }
      }

      // Handle global.AlgorithmFramework.X patterns (for class constructors like LinkItem, KeySize)
      // e.g., global.AlgorithmFramework.LinkItem -> LinkItem
      if (node.object.type === 'MemberExpression' &&
          node.object.object.type === 'Identifier') {
        const root = node.object.object.name;
        const middle = node.object.property.name || node.object.property.value;
        const member = node.property.name || node.property.value;
        if ((root === 'global' || root === 'globalThis') && middle === 'AlgorithmFramework')
          return new PerlIdentifier(member);
      }

      // Handle AlgorithmFramework enum constants - convert to string constants
      // These are things like CategoryType.BLOCK, SecurityStatus.SECURE, etc.
      const ENUM_CLASSES = new Set([
        'CategoryType', 'SecurityStatus', 'ComplexityType', 'CountryCode'
      ]);

      // Known framework classes that should be used directly
      const FRAMEWORK_TYPES = new Set([
        'KeySize', 'LinkItem', 'Vulnerability', 'TestCase'
      ]);

      // Handle AlgorithmFramework.X pattern - strip the AlgorithmFramework. prefix
      // e.g., AlgorithmFramework.CategoryType -> CategoryType identifier
      // e.g., AlgorithmFramework.KeySize -> KeySize identifier
      if (node.object.type === 'Identifier' && node.object.name === 'AlgorithmFramework') {
        const propName = node.property.name || node.property.value;

        // For enums, return the enum identifier (which will be handled by the next iteration)
        if (ENUM_CLASSES.has(propName))
          return new PerlIdentifier(propName);

        // For helper classes, return the class name
        if (FRAMEWORK_TYPES.has(propName))
          return new PerlIdentifier(propName);

        // AlgorithmFramework.Algorithms - the live registry array (e.g.
        // "AlgorithmFramework.Algorithms.find(a => a.name === 'DES')",
        // mdc2.js's own-dependency lookup). Falling through to the generic
        // "return as identifier" case below produced a bare `Algorithms`
        // PerlIdentifier with no sigil - wrapArrayDeref then force-prefixed
        // it with '@' as if it were an already-declared Perl array
        // ("@Algorithms"), which was never declared ("Global symbol
        // @Algorithms requires explicit package name"). The real backing
        // store is @main::_registered_algorithms, the same array
        // RegisterAlgorithm(...) populates and AlgorithmFramework::Find(...)
        // searches (see PerlEmitter.js emitAlgorithmFrameworkFindStub).
        if (propName === 'Algorithms') {
          this.usesRegisterAlgorithm = true;
          return new PerlIdentifier('main::_registered_algorithms', '@');
        }

        // For other properties, return as identifier
        return new PerlIdentifier(propName);
      }

      // Handle AlgorithmFramework.CategoryType.BLOCK pattern (nested)
      // e.g., AlgorithmFramework.CategoryType.BLOCK -> 'BLOCK'
      if (node.object.type === 'MemberExpression' &&
          node.object.object.type === 'Identifier' &&
          node.object.object.name === 'AlgorithmFramework') {

        const middleProp = node.object.property.name || node.object.property.value;
        const outerProp = node.property.name || node.property.value;

        // For enum constants, return string value
        if (ENUM_CLASSES.has(middleProp))
          return PerlLiteral.String(outerProp, "'");

        // For other nested access, just return the outer property
        return new PerlIdentifier(outerProp);
      }

      if (node.object && node.object.type === 'Identifier' && ENUM_CLASSES.has(node.object.name)) {
        // Convert to string constant: CategoryType.BLOCK -> 'BLOCK'
        const enumValue = node.property.name || node.property.value;
        return PerlLiteral.String(enumValue, "'");
      }

      // "<X>.PropName" where PropName is itself class-shaped (ends
      // "Algorithm"/"Instance") - a UMD factory-function parameter holding
      // a require()'d dependency's exports (e.g. "const DESModule =
      // require('../block/des');" unwrapped to a bare "DESModule" factory
      // param, then "DESModule.DESAlgorithm"/"DESModule.DESInstance" reads
      // a named export - see mac/cbcmac.js, mac/dmac.js, mac/dstu7624mac.js,
      // block/ff.js's "RijndaelModule.RijndaelAlgorithm", block/lion.js's
      // lowercase "sha1Module.SHA1Algorithm"/"rc4Module.RC4Algorithm",
      // mac/zuc128mac.js's bare (no "Module" suffix at all) "ZUC.ZUCAlgorithm",
      // ...). Falling into the isClassObj branch just below (its own
      // "endsWith('Module')" check, meant for genuine ClassName-shaped
      // identifiers) treated the wrapper name itself as a usable Perl
      // package name, emitting the nonsensical bareword-method-call
      // "DESModule->DESAlgorithm" ("Can't locate object method DESAlgorithm
      // via package DESModule" - no such package exists) - or, for a
      // wrapper name matching no class-suffix heuristic at all (bare "ZUC"),
      // fell all the way through to the untracked-scalar default, emitting
      // an undeclared "$ZUC" ("Global symbol $ZUC requires explicit package
      // name"). The dependency's classes are bundled directly at the top
      // level in the standalone-Perl output (see measure_pl.js's general
      // dependency bundling), so the module-namespace wrapper is
      // meaningless here regardless of its own name - only the final
      // property name (the actual bundled class name) matters. Checked
      // ahead of isClassObj so it wins for this shape; excluded whenever
      // the wrapper name is itself a real bundled/defined class or a
      // tracked local variable (definedClassNames/variableTypes), which
      // isClassObj still handles correctly.
      if (this._isUmdDependencyModuleAccess(node)) {
        const propName = node.property.name || node.property.value;
        return new PerlIdentifier(propName);
      }

      // When the object is a class name (package) and we're accessing a property,
      // use Perl package variable syntax $ClassName::property instead of
      // 'ClassName'->{'property'} which causes symbolic reference errors under strict
      if (!node.computed && node.object.type === 'Identifier') {
        const objName = node.object.name;
        const isClassObj = this._isClassObjName(objName);
        if (isClassObj) {
          const member = node.property.name || node.property.value;
          // Use package variable syntax for data properties: $ClassName::PROPERTY.
          // this.staticFieldNames (see its doc comment) covers every real
          // "static FIELD = ...;" class field name found anywhere in the
          // file - e.g. block/aria.js's "static SB1/SB2/SB3/SB4 =
          // Object.freeze([...])" S-box tables (read inside its own "static
          // { ... }" initializer block as "AriaInstance.SB1[i]") - a
          // hand-maintained name list (_isClassStaticField's fallback set)
          // can never keep up with every such table across the whole
          // codebase. Missing an entry here previously fell to the generic
          // bareword-method-call fallback just below, dying "Can't locate
          // object method SB1 via package AriaInstance" (SB1 is a package
          // variable, not a class method).
          // A name actually declared as a "static get NAME() {...}" getter
          // in THIS file always wins over the hardcoded dataProps guess
          // (see staticGetterNames' doc comment) - it's backed by a real
          // combined-accessor Perl sub (transformAccessorPair), never a
          // package variable, so it must be read via a method call.
          const isRealStaticGetter = this.staticGetterNames && this.staticGetterNames.has(member);
          if (!isRealStaticGetter && this._isClassStaticField(member)) {
            return new PerlRawCode(`$${objName}::${member}`);
          }
          // For method calls or other member access, use bareword package name
          return new PerlMemberAccess(new PerlIdentifier(objName, ''), member, '->');
        }
      }

      const object = this.transformExpression(node.object);

      if (node.computed) {
        // Check for string indexing: str[i] -> substr($str, $i, 1)
        // JavaScript strings support bracket indexing like arrays
        if (this.isStringType(node.object)) {
          const index = this.transformExpression(node.property);
          // Matches JS's str[i] bracket-indexing semantics exactly: JS
          // returns `undefined` for ANY out-of-range index (negative, or
          // >= length), whereas a bare Perl substr($str, $i, 1) instead
          // returns a *defined* empty string when $i == length($str) (only
          // $i > length actually produces undef, with a warning) - see
          // classical/playfair.js's "normalizedInput[i + 1] === undefined
          // ? (pad with X) : ..." odd-length-message check, which silently
          // never fired (the comparison saw a defined '', not undef) at
          // exactly the last character, dropping the required padding
          // letter and corrupting the final digraph of any odd-length
          // message. Explicitly returning Perl's own `undef` for any
          // out-of-range index (matching JS's boundary precisely, and
          // avoiding the "substr outside of string" warning for indices
          // past the end) lets the existing generic "undefined"-comparison
          // rewrites elsewhere in this file work unchanged.
          return new PerlRawCode(`do { my $_idx = ${index}; my $_str = ${object}; ($_idx >= 0 && $_idx < length($_str)) ? substr($_str, $_idx, 1) : undef }`);
        }

        // Array/hash indexing
        // JavaScript arrays are always references in Perl ($arr = [])
        // so we need arrow notation: $arr->[0] not $arr[0]
        const index = this.transformExpression(node.property);
        const subscriptType = this.isArrayContext(node.object, node.property) ? 'array' : 'hash';
        // isRefDeref = true because JS arrays/objects are Perl references
        return new PerlSubscript(object, index, subscriptType, true);
      } else {
        // Object method or field access
        const member = node.property.name || node.property.value;

        // Handle special properties
        if (member === 'length') {
          // @array in scalar context or length($string)
          return new PerlUnaryExpression('scalar', object);
        }

        // Known data properties in algorithm framework that need hash access, not method call
        // These are properties accessed as obj.Property, not obj.method()
        const dataProperties = new Set([
          // Algorithm metadata
          'SupportedKeySizes', 'SupportedBlockSizes', 'SupportedIvSizes',
          'BlockSize', 'KeySize', 'IvSize', 'OutputSize',
          'ROUNDS', 'DELTA', 'CYCLES', 'NUM_WORDS', 'WORD_SIZE',
          'name', 'description', 'inventor', 'year', 'category',
          'subCategory', 'securityStatus', 'complexity', 'country',
          'tests', 'documentation', 'comment', 'algorithm',
          // Instance properties
          'minSize', 'maxSize', 'stepSize',
          'isInverse', 'inputBuffer', 'outputBuffer',
          '_key', '_iv', '_nonce', '_state', '_buffer',
          'keyWords', 'sbox', 'S', 'P', 'K', 'L', 'R',
          'roundKeys', 'subkeys', 'expandedKey',
          // Config object properties (from variant configs)
          'config', 'sumBits', 'modulo', 'base', 'resultBytes',
          'blockSize', 'keySize', 'ivSize', 'tagSize', 'nonceSize',
          'rounds', 'wordSize', 'numWords', 'delta', 'cycles'
        ]);

        // Use hash subscript access for known data properties
        if (dataProperties.has(member)) {
          return new PerlSubscript(object, PerlLiteral.String(member, "'"), 'hash', true);
        }

        // Reading a well-known Instance-interface property (this.blockCipher.key,
        // cipher1.key, this.cshake.customization, ...) off a sub-instance
        // must go through its get/set accessor - see _isCipherInstanceRef()
        // and CROSS_INSTANCE_ACCESSOR_PROPS' doc comments for why
        // classAccessors can't see this.
        if (CROSS_INSTANCE_ACCESSOR_PROPS.has(member) && this._isCipherInstanceRef(node.object)) {
          return new PerlMemberAccess(object, new PerlCall(new PerlIdentifier(member), []), '->');
        }

        // Bare (non-computed, non-call) property read/write target - obj.prop
        // used as a value rather than invoked. Genuine method calls
        // (obj.method(args)) never reach this function at all - they're
        // intercepted directly in transformCallExpression, which knows
        // unambiguously that the MemberExpression callee is being invoked.
        // A bare access reaching here is therefore virtually always a data
        // field read in this codebase's idiom (config/constant objects,
        // metadata, etc.), so default to hash access rather than guessing
        // it's a parenthesis-less method call.
        return new PerlSubscript(object, PerlLiteral.String(member, "'"), 'hash', true);
      }
    }

    /**
     * True when `node` (a raw, pre-transform MemberExpression) is the
     * "<X>.PropName" UMD-dependency-module-export access pattern - see the
     * matching comment at this predicate's call site in
     * transformMemberExpression for the full rationale/examples.
     * @param {object} node - MemberExpression IL/AST node
     * @returns {boolean}
     */
    _isUmdDependencyModuleAccess(node) {
      if (node.computed || node.object?.type !== 'Identifier') return false;
      const objName = node.object.name;
      const propName = node.property?.name || node.property?.value;
      if (this.definedClassNames.has(objName) || this.variableTypes.has(objName)) return false;
      if (/Module$/.test(objName)) return true;
      return typeof propName === 'string' && /^[A-Z][A-Za-z0-9]*(Algorithm|Instance)$/.test(propName);
    }

    /**
     * If node is a non-computed MemberExpression CallExpression whose
     * object is a known Map or Set variable/field (see mapVarNames/
     * setVarNames/mapFieldNames/setFieldNames), translate the JS Map/Set
     * instance method (get/set/has/delete/clear/keys/values) into the
     * native Perl hash operation on the underlying hashref. Returns null
     * (not a Map/Set call, or an unhandled method - e.g. forEach/entries)
     * so the caller falls through to the generic method-call handling.
     * @param {object} node - CallExpression IL node
     * @returns {PerlNode|null}
     */
    /**
     * Classify an expression node as referencing a known Map/Set-backed
     * hashref - a plain variable/field (mapVarNames/setVarNames/
     * mapFieldNames/setFieldNames), or one of the two "container of
     * Map/Set" shapes tracked by setArrayFieldNames/mapOfSetFieldNames
     * (see their call site comments): "this.field[i]" (array of Sets) and
     * "this.field.get(k)" (Map of Sets). Shared by _transformMapOrSetMethodCall
     * (method-call rewriting) and the ArrayFrom/spread/for-of call sites
     * that need to know an expression is Set-shaped without themselves
     * calling a method on it.
     * @param {object} objNode
     * @returns {{isMap: boolean, isSet: boolean}}
     */
    _classifyMapSetContainer(objNode) {
      let name = null;
      let isMap = false, isSet = false;
      if (!objNode) return { isMap, isSet };
      if (objNode.type === 'Identifier') {
        name = objNode.name;
        isMap = this.mapVarNames && this.mapVarNames.has(name);
        isSet = this.setVarNames && this.setVarNames.has(name);
      } else if (objNode.type === 'ThisPropertyAccess') {
        name = typeof objNode.property === 'string' ? objNode.property : (objNode.property?.name || objNode.property?.value);
        isMap = name && this.mapFieldNames && this.mapFieldNames.has(name);
        isSet = name && this.setFieldNames && this.setFieldNames.has(name);
      } else if (objNode.type === 'MemberExpression' && !objNode.computed && objNode.object?.type === 'ThisExpression') {
        name = objNode.property?.name || objNode.property?.value;
        isMap = name && this.mapFieldNames && this.mapFieldNames.has(name);
        isSet = name && this.setFieldNames && this.setFieldNames.has(name);
      } else if (objNode.type === 'MemberExpression' && objNode.computed && objNode.object?.type === 'ThisPropertyAccess') {
        // this.field[i] - array-of-Set field. Left untouched and
        // transformed normally by the caller - it's an ordinary
        // array-index read, the array element it yields just happens to
        // be a Set-backed hashref.
        const arrName = typeof objNode.object.property === 'string' ? objNode.object.property : (objNode.object.property?.name || objNode.object.property?.value);
        isSet = arrName && this.setArrayFieldNames && this.setArrayFieldNames.has(arrName);
      } else if (objNode.type === 'CallExpression' && objNode.callee?.type === 'MemberExpression' && !objNode.callee.computed &&
                 objNode.callee.object?.type === 'ThisPropertyAccess' &&
                 (objNode.callee.property?.name || objNode.callee.property?.value) === 'get') {
        // this.field.get(k) - Map-of-Set field. objNode is itself a Map
        // .get() call on a known Map field, so transforming it normally
        // re-enters _transformMapOrSetMethodCall and rewrites it to the
        // equivalent hash-subscript read.
        const mapName = typeof objNode.callee.object.property === 'string' ? objNode.callee.object.property : (objNode.callee.object.property?.name || objNode.callee.object.property?.value);
        isSet = mapName && this.mapOfSetFieldNames && this.mapOfSetFieldNames.has(mapName);
      }
      return { isMap, isSet };
    }

    _transformMapOrSetMethodCall(node) {
      const objNode = node.callee.object;
      const { isMap, isSet } = this._classifyMapSetContainer(objNode);
      if (!isMap && !isSet) return null;

      const methodName = node.callee.property.name || node.callee.property.value;
      const hashExpr = this.transformExpression(objNode);
      const args = node.arguments.map(arg => this.transformExpression(arg));

      if (methodName === 'has') {
        return new PerlCall('exists', [new PerlSubscript(hashExpr, args[0], 'hash', true)]);
      }
      if (methodName === 'delete') {
        return new PerlCall('delete', [new PerlSubscript(hashExpr, args[0], 'hash', true)]);
      }
      if (methodName === 'clear') {
        return new PerlAssignment(new PerlUnaryExpression('%', hashExpr, true), '=', new PerlList([]));
      }
      if (methodName === 'keys') {
        return new PerlCall('keys', [new PerlUnaryExpression('%', hashExpr, true)]);
      }
      if (isMap && methodName === 'get') {
        return new PerlSubscript(hashExpr, args[0], 'hash', true);
      }
      if (isMap && methodName === 'set') {
        // Map.prototype.set(k, v) returns the Map itself (for chaining) -
        // not reproduced here; every call site in this codebase uses it as
        // a bare statement, and the assignment's own value (v) is a
        // reasonable fallback if it's ever used as an expression.
        return new PerlAssignment(new PerlSubscript(hashExpr, args[0], 'hash', true), '=', args[1]);
      }
      if (isMap && methodName === 'values') {
        return new PerlCall('values', [new PerlUnaryExpression('%', hashExpr, true)]);
      }
      if (isSet && methodName === 'add') {
        return new PerlAssignment(new PerlSubscript(hashExpr, args[0], 'hash', true), '=', PerlLiteral.Number(1));
      }

      return null; // Unhandled method (forEach, entries, ...) - fall through to generic handling
    }

    /**
     * Transform a call expression
     */
    transformCallExpression(node) {
      // Track calls to the framework's RegisterAlgorithm() so a no-op stub
      // sub can be emitted (the real AlgorithmFramework registry does not
      // exist in transpiled standalone Perl output). Some algorithm files
      // call the bare destructured RegisterAlgorithm(x), others call
      // AlgorithmFramework.RegisterAlgorithm(x) directly - both must resolve
      // to the same stub sub, so the member-call form is rewritten to a
      // bare call here too.
      if (node.callee.type === 'Identifier' && node.callee.name === 'RegisterAlgorithm')
        this.usesRegisterAlgorithm = true;

      // Same bare-destructured-call pattern, for "const { ..., Find } =
      // AlgorithmFramework;" then a later bare "Find(name)" (e.g. COMB4P's
      // ensureHashLoaded() helper) - unlike RegisterAlgorithm (whose bare
      // form already matches its stub sub's name, so no rewriting is
      // needed - see above), the AlgorithmFramework.Find(...) member-call
      // stub below is named "AlgorithmFramework::Find", so the bare form
      // must be rewritten to match or it's left calling a non-existent
      // bare "Find" sub ("Undefined subroutine &main::Find").
      if (node.callee.type === 'Identifier' && node.callee.name === 'Find') {
        this.usesAlgorithmFrameworkFind = true;
        const args = node.arguments.map(arg => this.transformExpression(arg));
        return new PerlCall(new PerlIdentifier('AlgorithmFramework::Find'), args);
      }

      // Matches both the bare "AlgorithmFramework.RegisterAlgorithm(x)" and
      // the more common "global.AlgorithmFramework.RegisterAlgorithm(x)"
      // (nested MemberExpression object) - only the final property name
      // actually identifies the call.
      if (node.callee.type === 'MemberExpression' &&
          (node.callee.property?.name === 'RegisterAlgorithm' || node.callee.property?.value === 'RegisterAlgorithm')) {
        this.usesRegisterAlgorithm = true;
        const args = node.arguments.map(arg => this.transformExpression(arg));
        return new PerlCall(new PerlIdentifier('RegisterAlgorithm'), args);
      }

      // <X>.Find(name) - looks up an already-registered algorithm by name
      // (used by the require()-guarded lazy dependency loaders that
      // _stripRequireGuardedBlocks in type-aware-transpiler.js rescues from
      // being stubbed out entirely - see PerlEmitter.js's
      // emitAlgorithmFrameworkFindStub for the backing implementation,
      // which searches the same @_registered_algorithms array the
      // RegisterAlgorithm stub above populates). Matched on the property
      // name alone (not requiring the receiver to be the literal bare
      // "AlgorithmFramework" identifier) - across the whole algorithms/
      // tree, every single ".Find(" call is this exact registry lookup,
      // whether written as the direct "AlgorithmFramework.Find(...)" or
      // indirectly through a local alias/field holding the same reference
      // (e.g. mac/iso9797alg3.js's "const AF = globalObj.AlgorithmFramework
      // || AlgorithmFramework; ... AF.Find('DES')", or
      // "this._algorithmFramework.Find('DES')"). The receiver expression is
      // side-effect-free in every such case (a plain identifier/field read),
      // so discarding it and emitting a fully qualified sub call is safe -
      // the previous "object must be literally named AlgorithmFramework"
      // requirement missed every indirect-alias call, leaving them as a
      // generic bareword-class method call ("$AF->Find(...)") that dies
      // "Can't locate object method Find via package AlgorithmFramework"
      // whenever the AlgorithmFramework::Find stub sub below never got
      // emitted (usesAlgorithmFrameworkFind never having been set).
      if (node.callee.type === 'MemberExpression' &&
          (node.callee.property?.name === 'Find' || node.callee.property?.value === 'Find')) {
        this.usesAlgorithmFrameworkFind = true;
        const args = node.arguments.map(arg => this.transformExpression(arg));
        return new PerlCall(new PerlIdentifier('AlgorithmFramework::Find'), args);
      }

      // JS's Function.prototype.call(thisArg, ...args) - e.g.
      // hash/haval.js's "fpFunc.call(this, s6, s5, ...)"/compression/
      // zpaq.js's "transform.call(this, data)", where fpFunc/transform is a
      // bare (non-called) reference to one of the class's OWN methods
      // (this._deltaTransform, this.fp3_1, ...) stored in an array/variable
      // earlier and invoked later with an explicit `this` - see the
      // "this.methodName" bare-reference handling in the 'ThisPropertyAccess'
      // case above (transforms to "$self->can('methodName')", a genuine
      // Perl coderef that - unlike a normal method call - needs its
      // invocant supplied manually as the first argument, exactly like
      // JS's explicit ".call(this, ...)"). The generic MemberExpression-call
      // handling further below would otherwise treat "call" as an ordinary
      // (nonexistent) method name on whatever the coderef evaluates to -
      // "Can't call method 'call' on an undefined value"/similar. No
      // algorithm in this codebase defines a genuine method literally
      // named "call".
      if (node.callee.type === 'MemberExpression' && !node.callee.computed &&
          (node.callee.property?.name === 'call' || node.callee.property?.value === 'call') &&
          node.arguments.length >= 1) {
        const thisArgExpr = this.transformExpression(node.arguments[0]);
        const restArgs = node.arguments.slice(1).map(arg => this.transformExpression(arg));
        const targetExpr = this.transformExpression(node.callee.object);
        return new PerlMemberAccess(targetExpr, new PerlCall(null, [thisArgExpr, ...restArgs]), '->');
      }

      // Regex literal .test(str) - e.g. `/[A-Za-z]/.test(char)`. The
      // receiver is inspected on the *raw* AST node (mirroring the
      // isRegexArg checks used for .replace()/.split() above) rather than
      // via this.isStringType/transformExpression, since a RegExp literal
      // has no JS "type" our string/array inference would recognize -
      // reading `.regex.pattern`/`.regex.flags` directly off the Literal
      // node is the only reliable way to recover the pattern text. Becomes
      // a plain Perl boolean match ($str =~ /pattern/flags). (.exec() is
      // not handled - no algorithm in this repo currently calls it.)
      if (node.callee.type === 'MemberExpression' && !node.callee.computed &&
          node.callee.object && node.callee.object.type === 'Literal' && node.callee.object.regex) {
        const propName = node.callee.property?.name || node.callee.property?.value;
        if (propName === 'test') {
          const pattern = node.callee.object.regex.pattern;
          const flags = (node.callee.object.regex.flags || '').replace(/[^gimsx]/g, '');
          const str = this.transformExpression(node.arguments[0]);
          return new PerlBinaryExpression(str, '=~', new PerlRegex(pattern, flags));
        }
      }

      // Fallback for string methods (.charAt/.charCodeAt/.toUpperCase/...)
      // that the type-aware-transpiler's IL pass didn't statically resolve
      // to a dedicated StringCharAt/StringCharCodeAt/StringTransform/...
      // node (its static type flow doesn't always reach through every
      // intermediate assignment - see this.stringFieldNames/classStringGetters/
      // stringVariables, which cover cases it misses) - left as a plain
      // CallExpression, this fell all the way through to the generic
      // MemberExpression-call handling far below, which emits an ordinary
      // "$obj->charAt($i)" OO method call. Perl has no String class/methods,
      // so that always died with "Can't locate object method ... via
      // package "<the actual string value>"". Caught here, before any IL
      // dedicated-node handling would even apply (this function only runs
      // for nodes the IL pass left as plain CallExpression), and only once
      // isStringType structurally confirms the receiver really is a string -
      // otherwise this would misfire on an unrelated same-named method of a
      // real class instance (e.g. a hypothetical "obj.trim()").
      // obj.hasOwnProperty(key) -> exists $obj->{$key} - a plain JS object
      // (transpiled as a Perl hashref) used as a lookup table, e.g.
      // encoding/baudot.js's "this.algorithm.lettersToCode.hasOwnProperty(
      // char)" (checking whether a character is in the Letters-shift code
      // table before looking it up). hasOwnProperty is never a real method
      // any class in this codebase defines itself (it's inherited from
      // JS's Object.prototype), so matching on the method name alone is
      // safe - left unhandled, this fell through to a generic
      // "$obj->hasOwnProperty($key)" OO method call, dying "Can't call
      // method hasOwnProperty on unblessed reference" (plain hashrefs
      // aren't blessed into any package).
      if (node.callee.type === 'MemberExpression' && !node.callee.computed &&
          (node.callee.property?.name === 'hasOwnProperty' || node.callee.property?.value === 'hasOwnProperty') &&
          node.arguments.length === 1) {
        const obj = this.transformExpression(node.callee.object);
        const key = this.transformExpression(node.arguments[0]);
        return new PerlCall('exists', [new PerlSubscript(obj, key, 'hash', true)]);
      }

      if (node.callee.type === 'MemberExpression' && !node.callee.computed &&
          this.isStringType(node.callee.object)) {
        const methodName = node.callee.property?.name || node.callee.property?.value;
        const str = this.transformExpression(node.callee.object);
        const args = node.arguments.map(arg => this.transformExpression(arg));
        switch (methodName) {
          case 'charAt':
            return new PerlCall('substr', [str, args[0] || PerlLiteral.Number(0), PerlLiteral.Number(1)]);
          case 'charCodeAt':
            return new PerlCall('ord', [new PerlCall('substr', [str, args[0] || PerlLiteral.Number(0), PerlLiteral.Number(1)])]);
          case 'toUpperCase':
            return new PerlCall('uc', [str]);
          case 'toLowerCase':
            return new PerlCall('lc', [str]);
          case 'trim':
            return new PerlRawCode(`do { my $_tmp_str = ${str}; $_tmp_str =~ s/^\\s+|\\s+$//g; $_tmp_str; }`);
          case 'trimStart':
          case 'trimLeft':
            return new PerlRawCode(`do { my $_tmp_str = ${str}; $_tmp_str =~ s/^\\s+//; $_tmp_str; }`);
          case 'trimEnd':
          case 'trimRight':
            return new PerlRawCode(`do { my $_tmp_str = ${str}; $_tmp_str =~ s/\\s+$//; $_tmp_str; }`);
          case 'indexOf':
            return new PerlCall('index', [str, ...args]);
          case 'includes':
            return new PerlBinaryExpression(new PerlCall('index', [str, args[0]]), '>=', PerlLiteral.Number(0));
          // Not a recognized string method (or one intentionally left for the
          // generic handling below, e.g. .length is a property not a call) -
          // fall through unhandled.
        }
      }

      // Handle .apply(thisArg, argsArray) pattern
      // e.g., String.fromCharCode.apply(null, bytes) -> pack('C*', @$bytes)
      if (node.callee.type === 'MemberExpression' &&
          (node.callee.property.name === 'apply' || node.callee.property.value === 'apply')) {
        const funcExpr = node.callee.object;
        if (funcExpr.type === 'MemberExpression' &&
            funcExpr.object.type === 'Identifier' &&
            funcExpr.object.name === 'String' &&
            (funcExpr.property.name === 'fromCharCode' || funcExpr.property.value === 'fromCharCode')) {
          // String.fromCharCode.apply(null, bytes) -> pack('C*', @$bytes)
          const argsArray = node.arguments[1]; // Second argument is the array
          if (argsArray) {
            const arr = this.transformExpression(argsArray);
            return new PerlCall('pack', [
              PerlLiteral.String('C*', "'"),
              new PerlUnaryExpression('@', arr, true)
            ]);
          }
        }

        // arr.push.apply(arr, otherArr) - a common pre-spread-syntax idiom
        // for "append every element of otherArr to arr" - e.g.
        // output.push.apply(output, processed) -> push @{$output}, @{$processed}
        if (funcExpr.type === 'MemberExpression' &&
            (funcExpr.property.name === 'push' || funcExpr.property.value === 'push')) {
          const argsArray = node.arguments[1]; // Second argument is the array being appended
          if (argsArray) {
            const targetArr = this.transformExpression(funcExpr.object);
            const srcArr = this.transformExpression(argsArray);
            return new PerlCall('push', [
              this.wrapArrayDeref(targetArr),
              new PerlUnaryExpression('@', srcArr, true)
            ]);
          }
        }

        // OpCodes.Pack16BE/LE|Pack32BE/LE|Pack64BE/LE.apply(null, bytesArray) -
        // e.g. hash/echo.js's "OpCodes.Pack32LE.apply(null,
        // OpCodes.Unpack32BE(AES_TE0[i]))" (re-packing an already-unpacked
        // byte array with the opposite endianness). A direct
        // "OpCodes.Pack32LE(b0, b1, b2, b3)" call reduces inline via the
        // PackBytes IL node (see transformPackBytes) - but that only
        // recognizes an actual call with individual arguments, not a
        // reference to the function passed through .apply()/an argument
        // array, which fell through to a nonsensical bareword method-chain
        // ("OpCodes->Pack32LE->apply(...)" - Pack32LE isn't a real sub,
        // dying "Can't locate object method Pack32LE via package OpCodes").
        if (funcExpr.type === 'MemberExpression' &&
            funcExpr.object.type === 'Identifier' && funcExpr.object.name === 'OpCodes') {
          const packMatch = /^Pack(16|32|64)(BE|LE)$/.exec(funcExpr.property.name || funcExpr.property.value || '');
          const argsArray = node.arguments[1];
          if (packMatch && argsArray) {
            const bits = parseInt(packMatch[1], 10);
            const isBig = packMatch[2] === 'BE';
            const format = bits === 16 ? (isBig ? 'n' : 'v') : bits === 64 ? (isBig ? 'Q>' : 'Q<') : (isBig ? 'N' : 'V');
            const arr = this.transformExpression(argsArray);
            return new PerlCall('unpack', [
              PerlLiteral.String(format, "'"),
              new PerlCall('pack', [
                PerlLiteral.String('C' + (bits / 8), "'"),
                new PerlUnaryExpression('@', arr, true)
              ])
            ]);
          }
        }
      }

      // Handle OpCodes method calls - including through a local alias
      // variable (see opCodesAliasNames' doc comment, e.g. "const OC = ...
      // OpCodes ...; OC.Hex8ToBytes(...)").
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          (node.callee.object.name === 'OpCodes' || this.opCodesAliasNames.has(node.callee.object.name))) {
        return this.transformOpCodesCall(node);
      }

      // OpCodes.UInt64.<method>(...) - a sub-namespace call (OpCodes.js
      // groups its 64-bit [high32,low32]-pair helpers - add/sub/mul/rotl/
      // rotr/xor/and/or/not/clone/fromNumber/toBytes/... - under a nested
      // "UInt64" object, see e.g. hash/highway-hash.js's
      // "OpCodes.UInt64.xor(a, b)"). The check just above only matches
      // "OpCodes.Method(...)" (callee.object must be the bare "OpCodes"
      // Identifier directly) - callee.object here is itself the nested
      // MemberExpression "OpCodes.UInt64", so it fell through entirely to
      // the generic member-call default, emitting the nonsensical chained
      // bareword call "OpCodes->UInt64->clone(...)" ("Can't locate object
      // method UInt64 via package OpCodes" - UInt64 isn't a real sub).
      // Routed to a "uint64<method>" runtime-stub sub (see
      // PerlEmitter.js's emitOpCodesRuntimeStub), mirroring
      // transformOpCodesCall's own OpCodes::<method> fallback naming.
      if (node.callee.type === 'MemberExpression' && !node.callee.computed &&
          node.callee.object.type === 'MemberExpression' && !node.callee.object.computed &&
          node.callee.object.object.type === 'Identifier' && node.callee.object.object.name === 'OpCodes') {
        const namespace = (node.callee.object.property.name || node.callee.object.property.value || '').toLowerCase();
        const method = (node.callee.property.name || node.callee.property.value || '').toLowerCase();
        const args = node.arguments.map(arg => this.transformExpression(arg));
        this.usesOpCodesRuntimeFallback = true;
        return new PerlCall(new PerlMemberAccess(new PerlIdentifier('OpCodes'), new PerlIdentifier(namespace + method), '::'), args);
      }

      // JS Map/Set instance methods (get/set/has/delete/clear) called on a
      // variable known (from the mapVarNames/setVarNames/mapFieldNames/
      // setFieldNames whole-file pre-scan) to hold "new Map()"/"new Set()" -
      // see transformExpression's MapCreation/SetCreation cases, both of
      // which back the value with a plain Perl hashref. A bare hashref has
      // no get/set/has/... methods ("Can't call method ... on unblessed
      // reference"), so rewrite to the native Perl hash operation the
      // MapCreation/SetCreation representation actually needs.
      if (node.callee.type === 'MemberExpression' && !node.callee.computed) {
        const mapOrSetResult = this._transformMapOrSetMethodCall(node);
        if (mapOrSetResult) return mapOrSetResult;
      }

      // "ClassName.method(args)" where ClassName is a class defined in this
      // same file - in valid JS this can only be a call to a *static*
      // method (you cannot reach a prototype/instance method by dot-calling
      // the bare class identifier), so PerlTransformer emits it with no
      // leading self/class parameter (e.g. "sub roundFunction ($x) {...}" -
      // see transformClassDeclaration's static-method handling). Must be
      // checked before the generic "JavaScript global builtin static
      // methods" block just below, whose unmatched-method fallback
      // (`return new PerlMemberAccess(object, call, '->')`) would otherwise
      // catch it first and emit Perl's "->" arrow-call syntax, which ALWAYS
      // implicitly prepends the invocant as an extra leading argument
      // regardless of whether the sub declares a param for it -
      // "'SimonCipher'->roundFunction($x)" actually calls
      // roundFunction('SimonCipher', $x), one argument more than the sub
      // accepts ("Too many arguments for subroutine"). Perl's
      // package-qualified direct-call syntax "ClassName::method(args)"
      // calls the sub with exactly the given arguments and no implicit
      // invocant, matching how it was defined.
      if (node.callee.type === 'MemberExpression' && !node.callee.computed &&
          node.callee.object?.type === 'Identifier' && this.definedClassNames.has(node.callee.object.name)) {
        const methodName = node.callee.property.name || node.callee.property.value;
        if (methodName && methodName !== 'length') {
          const args = node.arguments.map(arg => this.transformExpression(arg));
          return new PerlCall(new PerlIdentifier(`${node.callee.object.name}::${methodName}`, ''), args);
        }
      }

      // Handle JavaScript global builtin static methods
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier') {
        const objName = node.callee.object.name;
        const methodName = node.callee.property.name || node.callee.property.value;
        const args = node.arguments.map(arg => this.transformExpression(arg));

        // Array.isArray(x) -> ref(x) eq 'ARRAY'
        if (objName === 'Array' && methodName === 'isArray') {
          return new PerlBinaryExpression(
            new PerlCall('ref', [args[0]]),
            'eq',
            PerlLiteral.String('ARRAY', "'")
          );
        }

        // Date.now() / performance.now() - millisecond timestamps used only
        // for internal perf-stats/profiling bookkeeping in this codebase
        // (never asserted against in a fixed test vector, so exact
        // precision/epoch doesn't matter - just that it resolves to *some*
        // number instead of dying on the undeclared bareword "Date"/
        // "performance", e.g. fountain-foundation.data.js's
        // PerformanceProfiler.start()/stop() timers). Time::HiRes::time()
        // is Perl's usual sub-second-resolution wall clock; multiplying by
        // 1000 matches JS's millisecond-since-epoch convention.
        if ((objName === 'Date' || objName === 'performance') && methodName === 'now') {
          this.addRequiredModule('Time::HiRes', 'time');
          return new PerlBinaryExpression(
            new PerlCall(new PerlMemberAccess(new PerlIdentifier('Time::HiRes'), new PerlIdentifier('time'), '::'), []),
            '*',
            PerlLiteral.Number(1000)
          );
        }

        // Array.from(x) / TypedArray.from(x) -> [@{$x}] (shallow copy), or
        // Array.from(x, mapFn) / TypedArray.from(x, mapFn) -> mapped copy.
        // JS typed arrays (Uint8Array, Int32Array, ...) have no Perl
        // equivalent - they're just plain arrayrefs of numbers here, so
        // TypedArray.from behaves identically to Array.from.
        const TYPED_ARRAY_FROM_NAMES = new Set([
          'Array', 'Uint8Array', 'Int8Array', 'Uint8ClampedArray',
          'Uint16Array', 'Int16Array', 'Uint32Array', 'Int32Array',
          'Float32Array', 'Float64Array'
        ]);
        if (TYPED_ARRAY_FROM_NAMES.has(objName) && methodName === 'from') {
          const mapFnArg = node.arguments[1];
          // Array.from(aString) splits into individual characters in JS -
          // an entirely different operation from Array.from(anArrayLike)
          // (shallow copy/identity below). Reusing the existing IL
          // 'StringSplit' case (str.split('') -> [split('', $str)]) via a
          // synthetic node - rather than falling through to "just return
          // the argument" - since that previously handed back the *string
          // itself* unchanged, and a later "@{$thatResult}" array-deref of
          // it (e.g. ".map(c => c.charCodeAt(0))") died with "Can't use
          // string ... as an ARRAY ref".
          const srcArg = node.arguments[0];
          const srcIsString = this.isStringType(srcArg);
          const arrayArg = srcIsString
            ? { type: 'StringSplit', ilNodeType: 'StringSplit', string: srcArg, separator: null }
            : srcArg;
          if (mapFnArg && (mapFnArg.type === 'ArrowFunctionExpression' || mapFnArg.type === 'ArrowFunction' || mapFnArg.type === 'FunctionExpression')) {
            return this.transformArrayMap({ array: arrayArg, callback: mapFnArg });
          }
          if (srcIsString) return this.transformExpression(arrayArg);
          // Just return the argument - in Perl context, if we need a copy we use [@{$x}]
          // But for most uses in crypto code, the original reference is fine
          return args[0];
        }

        // Object.keys(x) -> keys %{$x}
        if (objName === 'Object' && methodName === 'keys') {
          return new PerlCall('keys', [new PerlUnaryExpression('%', args[0], true)]);
        }

        // Object.values(x) -> values %{$x}
        if (objName === 'Object' && methodName === 'values') {
          return new PerlCall('values', [new PerlUnaryExpression('%', args[0], true)]);
        }

        // Object.entries(x) -> handled as array of [key, value] pairs
        if (objName === 'Object' && methodName === 'entries') {
          return new PerlCall('map', [
            new PerlBlock([
              new PerlExpressionStatement(
                new PerlArray([new PerlIdentifier('_', '$'), new PerlSubscript(args[0], new PerlIdentifier('_', '$'), 'hash')])
              )
            ]),
            new PerlCall('keys', [new PerlUnaryExpression('%', args[0], true)])
          ]);
        }

        // Object.freeze(x) -> $x (Perl doesn't have freeze, just return the object)
        if (objName === 'Object' && methodName === 'freeze') {
          return args[0];
        }

        // Object.assign(target, ...sources) -> do { my $t = $target; @{$t}{keys %$s} = values %$s for @sources; $t }
        if (objName === 'Object' && methodName === 'assign') {
          // Simple case: just return the target, sources would be merged at runtime
          // For static analysis, the IL transformer should handle this
          return args[0];
        }

        // Object.create(proto) -> shallow-copy proto's own fields/methods into
        // a fresh blessed hashref (see the IL 'ObjectCreate' case above for
        // why this must preserve proto's contents and bless into
        // _LegacyAlgoObj rather than return an empty hash - that previously
        // discarded every field/method a legacy object-literal algorithm's
        // "Object.create(this)" instance-creation call relied on).
        if (objName === 'Object' && methodName === 'create') {
          this.usesLegacyAlgoObj = true;
          if (!args.length) return new PerlHash([]);
          return new PerlBless(new PerlRawCode(`{%{${args[0]}}}`), '_LegacyAlgoObj');
        }

        // JSON.stringify(x) -> use JSON; JSON::encode_json($x) - see the
        // matching 'JsonSerialize' IL case for why this must be a fully-
        // qualified call rather than relying on "use JSON qw(encode_json)"'s
        // import (which doesn't reach the other "package Foo;" blocks this
        // file's other transpiled classes compile into).
        if (objName === 'JSON' && methodName === 'stringify') {
          this.addRequiredModule('JSON');
          return new PerlCall('JSON::encode_json', args);
        }

        // JSON.parse(x) -> use JSON; JSON::decode_json($x)
        if (objName === 'JSON' && methodName === 'parse') {
          this.addRequiredModule('JSON');
          return new PerlCall('JSON::decode_json', args);
        }

        // console.log(x) -> print(x, "\n")
        // console.warn(x) -> warn(x)
        // console.error(x) -> warn(x) (Perl sends to STDERR)
        if (objName === 'console') {
          if (methodName === 'log') {
            return new PerlCall('print', [...args, PerlLiteral.String("\\n", '"')]);
          }
          if (methodName === 'warn' || methodName === 'error') {
            return new PerlCall('warn', args);
          }
          // Default to print for other console methods
          return new PerlCall('print', args);
        }

        // String.fromCharCode(x) -> chr(x); String.fromCharCode(...bytes)
        // (spread of a whole byte array, the far more common form in this
        // codebase's "convert this uint8[] to a string" idiom) needs the
        // join/map treatment instead - chr() has a scalar-only ($) Perl
        // prototype, so simply flattening the spread arg into its argument
        // list (as the generic spread-call-argument handling in PerlEmitter.
        // js's emitCall now does for ordinary subs) would pass chr() a
        // whole LIST, which a $-prototyped builtin evaluates in scalar
        // context - i.e. chr(scalar(@bytes)), not one chr() call per byte.
        if (objName === 'String' && methodName === 'fromCharCode') {
          if (node.arguments.length === 1 && node.arguments[0].type === 'SpreadElement') {
            const arr = this.transformExpression(node.arguments[0].argument);
            return new PerlCall('join', [
              PerlLiteral.String('', "'"),
              new PerlCall('map', [
                new PerlRawCode('{ chr($_) }'),
                new PerlUnaryExpression('@', arr, true)
              ])
            ]);
          }
          return new PerlCall('chr', args);
        }

        // Number.parseInt(x, radix) -> int($x) (simplified, ignores radix for now)
        if (objName === 'Number' && methodName === 'parseInt') {
          return new PerlCall('int', [args[0]]);
        }

        // Number.parseFloat(x) -> $x + 0
        if (objName === 'Number' && methodName === 'parseFloat') {
          return new PerlBinaryExpression(args[0], '+', new PerlLiteral(0));
        }

        // Number.isInteger(x) -> ($x == int($x))
        if (objName === 'Number' && methodName === 'isInteger') {
          const intCall = new PerlCall('int', [args[0]]);
          return new PerlGrouped(new PerlBinaryExpression(args[0], '==', intCall));
        }

        // Number.isNaN(x) -> (!defined($x) || $x ne $x)
        if (objName === 'Number' && methodName === 'isNaN') {
          const notDefined = new PerlUnaryExpression('!', new PerlCall('defined', [args[0]]), true);
          const neCheck = new PerlBinaryExpression(args[0], 'ne', args[0]);
          return new PerlGrouped(new PerlBinaryExpression(notDefined, '||', neCheck));
        }

        // Number.isFinite(x) -> defined($x) && $x !~ /^[+-]?inf/i
        if (objName === 'Number' && methodName === 'isFinite') {
          return new PerlCall('defined', [args[0]]);  // Simplified
        }

        // Math.min/max - use List::Util with fully qualified names
        //
        // CRITICAL: these must be brace-delimited. An "if (cond) stmt1;
        // stmt2;" without braces only guards stmt1 - stmt2 (the actual
        // "return new PerlCall(...)") would otherwise run unconditionally
        // for EVERY obj.method(args) call reaching this branch (any
        // MemberExpression call on a plain Identifier object that isn't
        // Array/Object/JSON/console/String/Number - e.g. ordinary
        // "helper.update(x)" composition calls), silently rewriting them
        // all into List::Util::min(...)/POSIX::floor(...) regardless of
        // the real object/method name.
        if (objName === 'Math' && methodName === 'min') {
          this.addRequiredModule('List::Util', 'min');
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("min"), "::"), args);
        }
        if (objName === 'Math' && methodName === 'max') {
          this.addRequiredModule('List::Util', 'max');
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("max"), "::"), args);
        }

        // Math.floor -> POSIX::floor with fully qualified name
        if (objName === 'Math' && methodName === 'floor') {
          this.addRequiredModule('POSIX');
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("floor"), "::"), args);
        }

        // Math.ceil -> POSIX::ceil
        if (objName === 'Math' && methodName === 'ceil') {
          this.addRequiredModule('POSIX');
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("ceil"), "::"), args);
        }

        // Math.round -> POSIX::round
        if (objName === 'Math' && methodName === 'round') {
          this.addRequiredModule('POSIX');
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("POSIX"), new PerlIdentifier("round"), "::"), args);
        }

        // Math.abs -> abs()
        if (objName === 'Math' && methodName === 'abs') {
          return new PerlCall('abs', args);
        }

        // Math.pow(a, b) -> a ** b
        if (objName === 'Math' && methodName === 'pow') {
          return new PerlBinaryExpression(args[0], '**', args[1]);
        }

        // Math.sqrt -> sqrt()
        if (objName === 'Math' && methodName === 'sqrt') {
          return new PerlCall('sqrt', args);
        }

        // Math.log -> log()
        if (objName === 'Math' && methodName === 'log') {
          return new PerlCall('log', args);
        }

        // Math.log2 -> log(x) / log(2)
        if (objName === 'Math' && methodName === 'log2') {
          return new PerlBinaryExpression(
            new PerlCall('log', args),
            '/',
            new PerlCall('log', [PerlLiteral.Number(2)])
          );
        }

        // Math.log10 -> log(x) / log(10)
        if (objName === 'Math' && methodName === 'log10') {
          return new PerlBinaryExpression(
            new PerlCall('log', args),
            '/',
            new PerlCall('log', [PerlLiteral.Number(10)])
          );
        }

        // Math.exp -> exp()
        if (objName === 'Math' && methodName === 'exp') {
          return new PerlCall('exp', args);
        }

        // Math.sin/cos/tan/atan/atan2
        if (objName === 'Math' && ['sin', 'cos', 'atan', 'atan2'].includes(methodName)) {
          return new PerlCall(methodName, args);
        }

        // Math.random() -> rand()
        if (objName === 'Math' && methodName === 'random') {
          return new PerlCall('rand', []);
        }
      }

      // Handle method calls
      if (node.callee.type === 'MemberExpression') {
        const method = node.callee.property.name || node.callee.property.value;

        // Handle array reduce specially
        if (method === 'reduce') {
          return this.transformArrayReduce(node);
        }

        let object = this.transformExpression(node.callee.object);
        // Perl's "->" (method/deref arrow) binds tighter than ||, &&, ?:,
        // binary operators, etc. - a method call on a compound expression
        // like "(bits[j] || 0).toString()" must keep its parens in the
        // output ("($bits->[$j] || 0)->toString()"), otherwise Perl parses
        // the unparenthesized "$bits->[$j] || 0->toString()" as
        // "$bits->[$j] || (0->toString())", silently calling the method on
        // the fallback literal instead of the whole expression.
        if (['BinaryExpression', 'LogicalExpression', 'ConditionalExpression',
             'AssignmentExpression', 'SequenceExpression'].includes(node.callee.object.type)) {
          object = new PerlGrouped(object);
        }
        const args = node.arguments.map(arg => this.transformExpression(arg));

        // "find"/"some"/"every"/single-arg "map"/"filter" below are name-only
        // fallbacks with no receiver-type check ("IL didn't detect it" -
        // i.e. this whole method-call block treats ANY "obj.method(...)"
        // whose method name matches an Array.prototype method as if obj were
        // an array, regardless of what obj actually is). That's usually
        // fine (these names rarely collide), but a user-defined class
        // method sharing one of these particular names is a real,
        // observed collision - e.g. a compression HashTable's own
        // "hashTable.find(buffer, pos, maxLen)" (a 3-arg match-finder, nothing
        // like Array.prototype.find's single-predicate signature) was
        // rewritten into "List::Util::first { $buffer } @$hashTable", pure
        // nonsense. Array.prototype.find/some/every/filter/(1-arg)map all
        // take a *function* as their first argument - real usages always
        // pass an arrow/function expression or an already-known code-ref/
        // named-function identifier; requiring that first is a cheap, safe
        // disambiguator that leaves genuine array-method calls untouched
        // and lets any non-matching call fall through to the plain
        // "$obj->method(args)" method-call handling further below instead.
        const firstArgNode = node.arguments[0];
        const firstArgIsCallback = firstArgNode && (
          firstArgNode.type === 'ArrowFunctionExpression' || firstArgNode.type === 'FunctionExpression' ||
          firstArgNode.type === 'ArrowFunction' ||
          (firstArgNode.type === 'Identifier' &&
            ((this.codeRefVariables && this.codeRefVariables.has(firstArgNode.name)) ||
             (this.functionNames && this.functionNames.has(firstArgNode.name))))
        );

        // Handle common array methods
        // slice() -> [@{$array}] or [@{$array}[start..end]]
        // NOTE: PerlArraySlice emits a bare list-slice expression
        // (@{$array}[a..b]) - it must be wrapped in a PerlArray to produce
        // an arrayref (a single scalar value), same as the args.length===0
        // case just below. Without the wrap, using the result as e.g. an
        // object-literal property value flattens the slice into the
        // surrounding list instead of storing it as one arrayref value
        // (silently corrupting hash literals like {k1: arr.slice(0,8)}).
        if (method === 'slice') {
          // No args: copy entire array
          if (args.length === 0) {
            return new PerlArray([new PerlUnaryExpression('@', object, true)]);
          }
          // See _buildArraySliceExpr's doc comment for why both start and
          // end need runtime negative-index normalization (e.g.
          // ecc/bch-code.js's "result.slice(-(divisorLen - 1))" /
          // ecc/hamming.js's "received.slice(0, -this._shortened)").
          return this._buildArraySliceExpr(object, args[0] || null, args.length >= 2 ? args[1] : null);
        }

        // push(@array, value) -> mutates array
        if (method === 'push') {
          return new PerlCall('push', [new PerlUnaryExpression('@', object, true), ...args]);
        }

        // pop(@array) -> removes and returns last
        if (method === 'pop') {
          return new PerlCall('pop', [new PerlUnaryExpression('@', object, true)]);
        }

        // shift(@array) -> removes and returns first
        if (method === 'shift') {
          return new PerlCall('shift', [new PerlUnaryExpression('@', object, true)]);
        }

        // unshift(@array, value) -> adds to front
        if (method === 'unshift') {
          return new PerlCall('unshift', [new PerlUnaryExpression('@', object, true), ...args]);
        }

        // join(sep) -> join($sep, @{$array})
        if (method === 'join') {
          const separator = args.length > 0 ? args[0] : PerlLiteral.String('', "'");
          return new PerlCall('join', [separator, new PerlUnaryExpression('@', object, true)]);
        }

        // indexOf(val) -> List::Util first_index
        if (method === 'indexOf') {
          this.addRequiredModule('List::Util', 'first');
          // Simplified: returns -1 or first matching index
          const grepExpr = new PerlCall('grep', [
            new PerlBlock([new PerlExpressionStatement(
              new PerlBinaryExpression(new PerlIdentifier('_', '$'), '==', args[0])
            )]),
            PerlLiteral.Number(0),
            new PerlBinaryExpression(new PerlCall('scalar', [new PerlUnaryExpression('@', object, true)]), '-', PerlLiteral.Number(1))
          ]);
          return grepExpr;
        }

        // includes(val) -> grep { $_ eq $val } @{$array}
        if (method === 'includes') {
          return new PerlCall('grep', [
            new PerlBlock([new PerlExpressionStatement(
              new PerlBinaryExpression(new PerlIdentifier('_', '$'), '==', args[0])
            )]),
            new PerlUnaryExpression('@', object, true)
          ]);
        }

        // some(fn) -> List::Util::any { fn->($_) } @{$array} - fallback when IL didn't detect it
        // (guarded by firstArgIsCallback - see firstArgIsCallback's doc comment just above)
        //
        // "callback" here is already the fully-transformed *value* expression
        // for the argument (an anonymous "sub ($x = undef) {...}" node for an
        // arrow/function-expression literal, or a bare identifier for a
        // named-function/code-ref variable) - it is NOT the raw arrow-function
        // AST node transformListUtilCallback()'s dedicated $_-substituting
        // path expects (that path renames every reference to the callback's
        // own parameter name to "$_" inside its body). Passing this
        // already-transformed value directly as List::Util's BLOCK argument
        // (as this used to) put a bare "sub {...}" value expression as the
        // block's only statement - the block itself always evaluates that
        // (truthy) coderef, so first/any/all matched unconditionally,
        // ignoring the real predicate entirely (e.g.
        // algorithms/mac/dstu7624mac.js's getKalyna() registry lookup,
        // "registry.find(a => a.name === 'Kalyna' || ...)", silently
        // returned the registry's first entry regardless of name). Instead,
        // wrap it in a block that actually *calls* it with the current
        // element ($_) - works uniformly whether callback is an anonymous
        // sub (PerlCall's "callee is an AnonSub" case renders
        // "(sub {...})->($_)") or a plain function/code-ref identifier
        // (renders as an ordinary call/->() invocation passing $_).
        const wrapAsPredicateBlock = (cb) => new PerlBlock([new PerlExpressionStatement(new PerlCall(cb, [new PerlIdentifier('_', '$')]))]);
        if (method === 'some' && firstArgIsCallback) {
          const callback = args[0];
          this.addRequiredModule('List::Util', 'any');
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("any"), "::"), [wrapAsPredicateBlock(callback), this.wrapArrayDeref(object)]);
        }

        // every(fn) -> List::Util::all { fn->($_) } @{$array} - fallback when IL didn't detect it
        if (method === 'every' && firstArgIsCallback) {
          const callback = args[0];
          this.addRequiredModule('List::Util', 'all');
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("all"), "::"), [wrapAsPredicateBlock(callback), this.wrapArrayDeref(object)]);
        }

        // find(fn) -> List::Util::first { fn->($_) } @{$array} - fallback when IL didn't detect it
        if (method === 'find' && firstArgIsCallback) {
          const callback = args[0];
          this.addRequiredModule('List::Util', 'first');
          return new PerlCall(new PerlMemberAccess(new PerlIdentifier("List::Util"), new PerlIdentifier("first"), "::"), [wrapAsPredicateBlock(callback), this.wrapArrayDeref(object)]);
        }

        // findIndex(fn) -> index of the first matching element, or -1 - no
        // dedicated handling previously existed at all (unlike find/some/
        // every just above), so this fell all the way through to the
        // generic MemberExpression-call fallback, emitting a plain Perl OO
        // method call ("$arrayref->findIndex(...)"). Perl arrayrefs have no
        // "findIndex" method (they're plain, unblessed references) - this
        // died "Can't call method "findIndex" on unblessed reference" for
        // every caller (e.g. compression/huffman.js's Huffman-tree-building
        // min-heap insertion point search). List::Util has no built-in
        // first-matching-*index* helper (only "first", which returns the
        // matching *element*), so this is hand-rolled as an indexed scan,
        // modeled on _transformIndexedEverySome's identical C-style-for
        // shape just above. Built from real PerlNode objects (not a
        // PerlRawCode template string interpolating the callback directly)
        // because an anonymous-sub node has no toString() (only a handful
        // of "operand-shaped" node classes do - see PerlConditional's
        // toString() doc comment for a fuller explanation of that exact
        // trap) - interpolating it directly rendered the useless default
        // "[object Object]" instead of real Perl code. Calling it via
        // "new PerlCall(callback, [elem])" instead lets emitCall's own
        // "callee.nodeType === 'AnonSub'" case (which *does* know how to
        // render an anonymous sub) build the "(sub {...})->(elem)"
        // IIFE-style invocation correctly.
        if (method === 'findIndex' && firstArgIsCallback) {
          const callback = args[0];
          const n = (this._findIndexCounter = (this._findIndexCounter || 0) + 1);
          const arrTmp = `_fi_arr${n}`;
          const idxTmp = `_fi_idx${n}`;
          const iTmp = `_fi_i${n}`;
          const elemExpr = new PerlSubscript(new PerlIdentifier(arrTmp, '@'), new PerlIdentifier(iTmp, '$'), 'array', false);
          const loopBody = new PerlBlock([
            new PerlIf(new PerlCall(callback, [elemExpr]), new PerlBlock([
              new PerlExpressionStatement(new PerlAssignment(new PerlIdentifier(idxTmp, '$'), '=', new PerlIdentifier(iTmp, '$'))),
              new PerlLast()
            ]))
          ]);
          const forLoop = new PerlFor(null, null, loopBody);
          forLoop.isCStyle = true;
          forLoop.init = new PerlVarDeclaration('my', iTmp, '$', PerlLiteral.Number(0));
          forLoop.condition = new PerlBinaryExpression(new PerlIdentifier(iTmp, '$'), '<', new PerlCall('scalar', [new PerlIdentifier(arrTmp, '@')]));
          forLoop.increment = new PerlUnaryExpression('++', new PerlIdentifier(iTmp, '$'), false);
          const block = new PerlBlock([
            new PerlVarDeclaration('my', arrTmp, '@', new PerlUnaryExpression('@', object, true)),
            new PerlVarDeclaration('my', idxTmp, '$', PerlLiteral.Number(-1)),
            forLoop,
            new PerlExpressionStatement(new PerlIdentifier(idxTmp, '$'))
          ]);
          return new PerlCall('do', [block]);
        }

        // map(fn) -> [map { fn } @{$array}] - fallback when IL didn't detect it
        if (method === 'map' && node.arguments.length === 1 && firstArgIsCallback) {
          const callback = args[0];
          return new PerlArray([new PerlCall('map', [callback, this.wrapArrayDeref(object)])]);
        }

        // filter(fn) -> [grep { fn } @{$array}] - fallback when IL didn't detect it
        if (method === 'filter' && firstArgIsCallback) {
          const callback = args[0];
          return new PerlArray([new PerlCall('grep', [callback, this.wrapArrayDeref(object)])]);
        }

        // reverse() -> [reverse @{$array}]
        if (method === 'reverse') {
          return new PerlArray([new PerlCall('reverse', [new PerlUnaryExpression('@', object, true)])]);
        }

        // sort() -> [sort @{$array}]
        if (method === 'sort') {
          if (args.length === 0) {
            return new PerlArray([new PerlCall('sort', [new PerlUnaryExpression('@', object, true)])]);
          }
          // With comparator - need special handling
          return new PerlArray([new PerlCall('sort', [args[0], new PerlUnaryExpression('@', object, true)])]);
        }

        // splice(start, deleteCount, ...items)
        if (method === 'splice') {
          return new PerlCall('splice', [new PerlUnaryExpression('@', object, true), ...args]);
        }

        // concat(...arrays) -> [@{$array1}, @{$array2}, ...]
        if (method === 'concat') {
          const allElements = [new PerlUnaryExpression('@', object, true)];
          for (const arg of args) {
            allElements.push(new PerlUnaryExpression('@', arg, true));
          }
          return new PerlArray(allElements);
        }

        // fill(value, start?, end?) -> simplified: replace all with value
        if (method === 'fill') {
          // Simplified: returns array of same length filled with value
          const len = new PerlCall('scalar', [new PerlUnaryExpression('@', object, true)]);
          return new PerlArray([
            new PerlBinaryExpression(
              new PerlGrouped(args[0]),
              'x',
              len
            )
          ]);
        }

        // Number.prototype.toFixed(digits) -> sprintf("%.<digits>f", $value)
        // (a plain numeric string, matching JS's own decimal-point
        // formatting - not locale-aware, same as toFixed itself). Falls
        // through to here as an ordinary MemberExpression/CallExpression
        // on whatever "object" scalar holds the number (the shared IL
        // parser doesn't recognize toFixed as anything special - see
        // ecc/dna-storage-code.js's "`GC-content ${gcPercent.toFixed(1)}%`"
        // error-message formatting) - without this, it fell all the way
        // through to a generic indirect method-call dispatch, "$gcPercent
        // ->toFixed(1)", which Perl resolves as calling ->toFixed on the
        // PACKAGE NAMED by $gcPercent's stringified value (e.g. "0" or
        // "48.5") - "Can't locate object method toFixed via package ...".
        if (method === 'toFixed') {
          const digits = args.length > 0 ? args[0] : PerlLiteral.Number(0);
          const digitsLiteral = (digits.nodeType === 'Literal' && typeof digits.value === 'number') ? digits.value : null;
          const fmt = digitsLiteral !== null ? `%.${digitsLiteral}f` : null;
          if (fmt !== null) {
            return new PerlCall('sprintf', [PerlLiteral.String(fmt, "'"), object]);
          }
          // Non-literal digit count: build the format string at runtime.
          return new PerlCall('sprintf', [
            new PerlStringInterpolation(['%.', digits, 'f']),
            object
          ]);
        }

        // String methods
        // toUpperCase() -> uc($str)
        if (method === 'toUpperCase') {
          return new PerlCall('uc', [object]);
        }

        // toLowerCase() -> lc($str)
        if (method === 'toLowerCase') {
          return new PerlCall('lc', [object]);
        }

        // charCodeAt(index) -> ord(substr($str, index, 1))
        if (method === 'charCodeAt') {
          const index = args.length > 0 ? args[0] : PerlLiteral.Number(0);
          return new PerlCall('ord', [
            new PerlCall('substr', [object, index, PerlLiteral.Number(1)])
          ]);
        }

        // split(sep) -> [split(/$sep/, $str)] or [split(//, $str)] for no arg
        // Note: Perl split returns a list, but JS split returns an array, so wrap in []
        if (method === 'split') {
          if (args.length === 0) {
            // Split into characters
            return new PerlArray([new PerlCall('split', [PerlLiteral.String('', "//"), object])]);
          }
          // Split by separator - if it's a string, quote it; if regex, use directly
          const origArg0 = (node.arguments || [])[0];
          let sep = args[0];
          // A plain (non-regex) string separator - e.g. "keyString.split('|')"
          // (classical/jefferson-wheel.js's key-string parsing) - must be
          // escaped before use: JS's String.prototype.split(str) treats str
          // as a literal substring, but Perl's split() ALWAYS treats its
          // first argument as a regex pattern. Passing the raw string
          // through unescaped let any regex metacharacter it contained
          // (here "|", alternating two empty patterns) silently change the
          // split semantics entirely - "|" split on every character
          // instead of on the literal pipe - rather than raising an error,
          // so this went unnoticed until the split-apart pieces (meant to
          // be parsed as numbers) turned out to still contain "|"
          // characters themselves, dying "Argument "|" isn't numeric in
          // int".
          if (origArg0 && origArg0.type === 'Literal' && !origArg0.regex && typeof origArg0.value === 'string') {
            const escaped = origArg0.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            sep = new PerlRegex(escaped, '');
          }
          return new PerlArray([new PerlCall('split', [sep, object])]);
        }

        // match(regex) -> str.match(/pattern/flags): no dedicated handling
        // previously existed at all, so this fell through every case below
        // to the generic MemberExpression-call fallback, emitting a plain
        // OO method call ("$str->match(...)") - Perl scalars have no
        // "match" method, dying "Can't locate object method "match" via
        // package "<the actual string value>"" at runtime.
        //
        // Without the /g flag, JS .match() returns null (no match) or an
        // array-like whose index 0 is the *whole* matched substring and
        // 1..N are the capture groups (e.g. "encrypted.match(/_([0-9]+)_BYTES_/)"
        // then reads match[1] for the captured digits - see rsa.js/
        // elgamal.js/esign.js/luc.js/ntru.js's educational
        // decrypt/keysetup routines). Perl's list-context "=~" only yields
        // the capture groups (no whole-match slot), so this emits
        // "[$&, $1, $2, ...]" (built with as many $N vars as the pattern
        // has capturing groups - see _countRegexCaptureGroups) inside a
        // do{if}else{undef} so a failed match still evaluates to undef,
        // matching JS's null (the common "if (str.match(...))"/
        // "match ? match[1] : ..." idioms both then behave the same way).
        //
        // With /g, JS .match() returns an array of every whole-match
        // substring (no capture groups) or null - Perl's list-context
        // "=~ /pat/g" already returns exactly that list of whole matches
        // (per perlop, /g in list context yields the match text itself
        // when the pattern has no capturing groups), so this is just
        // wrapped in an arrayref (e.g. "syndrome.match(/1/g) || []" in
        // ecc/hsiao-code.js, counting 1-bits).
        if (method === 'match') {
          const patternArg = (node.arguments || [])[0];
          const isRegexArg = !!(patternArg && patternArg.regex);
          const pattern = isRegexArg
            ? patternArg.regex.pattern
            : (args[0] ? String(patternArg.value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '');
          const flags = isRegexArg ? (patternArg.regex.flags || '').replace(/[^gimsx]/g, '') : '';
          if (flags.includes('g')) {
            return new PerlArray([new PerlBinaryExpression(object, '=~', new PerlRegex(pattern, flags))]);
          }
          const groupCount = this._countRegexCaptureGroups(pattern);
          const matchVars = [new PerlIdentifier('&', '$')];
          for (let i = 1; i <= groupCount; i++) matchVars.push(new PerlIdentifier(String(i), '$'));
          return new PerlCall('do', [new PerlBlock([
            new PerlIf(
              new PerlBinaryExpression(object, '=~', new PerlRegex(pattern, flags)),
              new PerlBlock([new PerlExpressionStatement(new PerlArray(matchVars))]),
              [],
              new PerlBlock([new PerlExpressionStatement(PerlLiteral.Undef())])
            )
          ])]);
        }

        // replace(pattern, replacement) -> simplified regex substitution
        // Note: JavaScript replace() with string only replaces first occurrence
        // but with /g flag replaces all. We'll use a basic approach.
        if (method === 'replace') {
          // Check original node.arguments for literal values
          const origArgs = node.arguments || [];
          if (origArgs[0] && origArgs[0].type === 'Literal' && origArgs[1] && origArgs[1].type === 'Literal') {
            // A JS regex literal (e.g. /[^A-Z]/g) parses to a Literal node
            // whose *pattern* lives in `.regex.pattern`/`.regex.flags` - its
            // own `.value` is just an empty placeholder object (see
            // TypeAwareJSASTParser), NOT the pattern text. Reading
            // "String(origArgs[0].value)" unconditionally (as this used to)
            // stringified that placeholder object via JS's default
            // Object.prototype.toString(), producing the literal text
            // "[object Object]" - which then got embedded as the regex
            // pattern in the emitted Perl s/// itself (dies at runtime, or
            // silently no-ops if it partially compiles), instead of the
            // intended character class. A regex literal's pattern also must
            // NOT be metacharacter-escaped like a plain string literal would
            // be (it's already a valid regex source), and its flags (g/i/m/s)
            // should carry over to the emitted s///<flags>.
            const isRegexArg = !!origArgs[0].regex;
            const pattern = isRegexArg
              ? origArgs[0].regex.pattern
              : String(origArgs[0].value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const flags = isRegexArg ? (origArgs[0].regex.flags || '').replace(/[^gimsx]/g, '') : '';
            const replacement = String(origArgs[1].value);
            // See the identical delimiter-safety comment at the other
            // (IL-node) .replace() handler above - a literal unescaped "/"
            // in the pattern (e.g. a "[.../]"-shaped character class)
            // breaks a "/"-delimited s///, so switch to bracket delimiters
            // whenever that happens.
            // Also switch to brace delimiters when the REPLACEMENT text
            // itself contains a literal "/" (see the identical fix/comment
            // at the other (IL-node) .replace() handler above) - this
            // legacy raw-arguments path builds "replacement" straight from
            // the literal's value with no delimiter-safety escaping at all.
            const useBraceDelim = /(?<!\\)\//.test(pattern) || replacement.includes('/');
            const open = useBraceDelim ? '{' : '/';
            const mid = useBraceDelim ? '}{' : '/';
            const close = useBraceDelim ? '}' : '/';
            const tempVar = new PerlIdentifier('_tmp_str', '$');
            return new PerlCall('do', [
              new PerlBlock([
                new PerlVarDeclaration('my', '_tmp_str', '$', object),
                new PerlExpressionStatement(new PerlBinaryExpression(
                  tempVar, '=~', new PerlIdentifier(`s${open}${pattern}${mid}${replacement}${close}${flags.includes('g') ? flags : 'g' + flags}`)
                )),
                tempVar
              ])
            ]);
          }
          // General case: the search value is not a literal (e.g. a single
          // dynamically-selected character, "alphabet.replace(cleanKey[i],
          // '')" - see classical/foursquare.js's/playfair.js's/twosquare.
          // js's/trifid.js's/jefferson-wheel.js's key-square construction,
          // which strips each already-used key letter out of the remaining
          // alphabet one at a time in a loop). The literal-only branch
          // above requires BOTH arguments to be Literal nodes; falling
          // through to the "return object unchanged" fallback below
          // silently dropped the entire replace() call whenever the search
          // value was a variable/expression - no error, just a same-string
          // no-op - corrupting every key square these ciphers build.
          // "\Q...\E" quotes any regex metacharacters in the search
          // expression's *runtime* value so it is matched as a literal
          // substring (matching JS's non-regex .replace() semantics
          // exactly), and the substitution is deliberately left non-global
          // (no /g) since JS's .replace() with a non-regex search value
          // only ever replaces the first occurrence. A literal-string
          // replacement is escaped and interpolated directly; a dynamic
          // replacement expression is instead spliced in via the
          // "@{[ ... ]}" deref-and-interpolate idiom (the replacement side
          // of s/// is double-quote-interpolated, exactly like a string
          // literal), so it's evaluated as a Perl expression rather than
          // read back as literal source text.
          if (origArgs[0] && origArgs[0].type !== 'Literal') {
            const searchExpr = args[0];
            let replCode;
            if (origArgs[1] && origArgs[1].type === 'Literal' && typeof origArgs[1].value === 'string') {
              replCode = String(origArgs[1].value)
                .replace(/\\/g, '\\\\')
                .replace(/\$/g, '\\$')
                .replace(/@/g, '\\@')
                .replace(/\//g, '\\/');
            } else {
              const replExpr = args[1] !== undefined ? args[1] : PerlLiteral.String('', "'");
              replCode = `@{[ ${replExpr} ]}`;
            }
            const tempVar = new PerlIdentifier('_tmp_str', '$');
            return new PerlCall('do', [
              new PerlBlock([
                new PerlVarDeclaration('my', '_tmp_str', '$', object),
                new PerlVarDeclaration('my', '_tmp_search', '$', searchExpr),
                new PerlExpressionStatement(new PerlBinaryExpression(
                  tempVar, '=~', new PerlIdentifier(`s/\\Q$_tmp_search\\E/${replCode}/`)
                )),
                tempVar
              ])
            ]);
          }
          // Fallback: return object unchanged (simplified)
          return object;
        }

        // substring(start, end) -> substr($str, start, end-start) - JS
        // substring()'s 2nd arg is an END INDEX.
        if (method === 'substring') {
          if (args.length === 1) {
            return new PerlCall('substr', [object, args[0]]);
          }
          if (args.length >= 2) {
            const length = new PerlBinaryExpression(args[1], '-', args[0]);
            return new PerlCall('substr', [object, args[0], length]);
          }
          return object;
        }

        // a.localeCompare(b) -> ($a cmp $b) - JS returns negative/0/positive
        // like Perl's "cmp" (a plain codepoint/ASCII ordering here, not a
        // real locale-aware collation - this codebase only ever compares
        // single Latin letters with it, e.g. classical/columnar.js's
        // transposition-column sort comparator, where that distinction
        // never matters). Previously unhandled, so it fell through to the
        // generic bareword method-call fallback ("$str->localeCompare(...)"),
        // dying "Can't locate object method localeCompare" (Perl scalars
        // aren't objects).
        if (method === 'localeCompare') {
          return new PerlGrouped(new PerlBinaryExpression(object, 'cmp', args[0]));
        }

        // substr(start, length) -> substr($str, start, length) - JS (legacy)
        // substr()'s 2nd arg is already a LENGTH, unlike substring()'s end
        // index - reusing substring's "end - start" formula here silently
        // shrank/corrupted every multi-char substr() call (e.g.
        // bitString.substr(i, 8) became substr($bitString, $i, 8 - $i)).
        if (method === 'substr') {
          if (args.length === 1) {
            return new PerlCall('substr', [object, args[0]]);
          }
          if (args.length >= 2) {
            return new PerlCall('substr', [object, args[0], args[1]]);
          }
          return object;
        }

        // trim() -> use simple substitution approach
        if (method === 'trim') {
          const tempVar = new PerlIdentifier('_tmp_str', '$');
          return new PerlCall('do', [
            new PerlBlock([
              new PerlVarDeclaration('my', '_tmp_str', '$', object),
              new PerlExpressionStatement(new PerlBinaryExpression(
                tempVar, '=~', new PerlIdentifier('s/^\\s+|\\s+$//g')
              )),
              tempVar
            ])
          ]);
        }

        // trimStart/trimLeft() -> $str =~ s/^\s+//
        if (method === 'trimStart' || method === 'trimLeft') {
          const tempVar = new PerlIdentifier('_tmp_str', '$');
          return new PerlCall('do', [
            new PerlBlock([
              new PerlVarDeclaration('my', '_tmp_str', '$', object),
              new PerlExpressionStatement(new PerlBinaryExpression(
                tempVar, '=~', new PerlIdentifier('s/^\\s+//')
              )),
              tempVar
            ])
          ]);
        }

        // trimEnd/trimRight() -> $str =~ s/\s+$//
        if (method === 'trimEnd' || method === 'trimRight') {
          const tempVar = new PerlIdentifier('_tmp_str', '$');
          return new PerlCall('do', [
            new PerlBlock([
              new PerlVarDeclaration('my', '_tmp_str', '$', object),
              new PerlExpressionStatement(new PerlBinaryExpression(
                tempVar, '=~', new PerlIdentifier('s/\\s+$//')
              )),
              tempVar
            ])
          ]);
        }

        // padStart(targetLength, padString=' ')/padEnd(targetLength,
        // padString=' ') - build the pad chunk by repeating padString
        // forward until long enough, then truncate to exactly the needed
        // length and prepend (padStart) / append (padEnd) it. A straight
        // port of the ECMA-262 algorithm (repeat the filler forward, keep
        // only the FIRST N characters of that repetition) - repeatedly
        // re-truncating from one end while building incrementally gives the
        // wrong bytes whenever padString is more than one character and
        // doesn't evenly divide the needed length. Used by several
        // compression algorithms' toString(2)/toString(16) bit/hex-string
        // construction (deflate-simple.js, elias-delta.js, huffman.js, ...) -
        // previously fell through to the generic bareword "->padStart(...)"
        // method call below, which died with "Can't locate object method
        // padStart" (Perl scalars aren't objects).
        if (method === 'padStart' || method === 'padEnd') {
          const isStart = method === 'padStart';
          const targetLen = args[0] || PerlLiteral.Number(0);
          const padStr = args[1] || PerlLiteral.String(' ', "'");
          const sVar = new PerlIdentifier('_pad_s', '$');
          const pVar = new PerlIdentifier('_pad_p', '$');
          const nVar = new PerlIdentifier('_pad_n', '$');
          const needVar = new PerlIdentifier('_pad_need', '$');
          const repVar = new PerlIdentifier('_pad_rep', '$');
          const lenOf = (e) => new PerlCall('length', [e]);

          const buildRep = new PerlWhile(
            new PerlBinaryExpression(lenOf(repVar), '<', needVar),
            new PerlBlock([new PerlExpressionStatement(new PerlAssignment(repVar, '.=', pVar))])
          );

          const innerIfBody = new PerlBlock([
            new PerlVarDeclaration('my', '_pad_need', '$', new PerlBinaryExpression(nVar, '-', lenOf(sVar))),
            new PerlVarDeclaration('my', '_pad_rep', '$', PerlLiteral.String('', "'")),
            buildRep,
            new PerlExpressionStatement(new PerlAssignment(repVar, '=', new PerlCall('substr', [repVar, PerlLiteral.Number(0), needVar]))),
            new PerlExpressionStatement(new PerlAssignment(
              sVar, '=',
              isStart ? new PerlBinaryExpression(repVar, '.', sVar) : new PerlBinaryExpression(sVar, '.', repVar)
            ))
          ]);

          const outerIf = new PerlIf(
            new PerlBinaryExpression(
              new PerlGrouped(new PerlBinaryExpression(lenOf(pVar), '>', PerlLiteral.Number(0))),
              '&&',
              new PerlGrouped(new PerlBinaryExpression(lenOf(sVar), '<', nVar))
            ),
            innerIfBody
          );

          return new PerlCall('do', [
            new PerlBlock([
              new PerlVarDeclaration('my', '_pad_s', '$', object),
              new PerlVarDeclaration('my', '_pad_p', '$', padStr),
              new PerlVarDeclaration('my', '_pad_n', '$', targetLen),
              outerIf,
              sVar
            ])
          ]);
        }

        // Number/generic .toString([radix]) - not a real Perl method call
        // (Perl scalars aren't objects), so "obj->toString()" would blow up
        // with "Can't locate object method toString" at runtime unless obj
        // happens to be blessed. Convert to the equivalent stringification.
        if (method === 'toString') {
          if (node.arguments[0] && node.arguments[0].type === 'Literal' && typeof node.arguments[0].value === 'number') {
            const radix = node.arguments[0].value;
            if (radix === 16) return new PerlCall('sprintf', [PerlLiteral.String('%x', "'"), object]);
            if (radix === 8) return new PerlCall('sprintf', [PerlLiteral.String('%o', "'"), object]);
            if (radix === 2) return new PerlCall('sprintf', [PerlLiteral.String('%b', "'"), object]);
            if (radix === 36) return new PerlRawCode(`do { my @_d = (0..9, 'a'..'z'); my $_n = ${object}; my $_s = ''; while ($_n > 0) { $_s = $_d[$_n % 36] . $_s; $_n = int($_n / 36); } $_s || '0'; }`);
          }
          // Plain toString() -> no-op stringification (Perl scalars are
          // already dual string/number and auto-stringify in string context)
          return object;
        }

        // Plain-data-hashref coderef property (see objectCoderefPropNames'
        // doc comment) - e.g. block/crypton.js's "tables.gammaTau(...)"/
        // "tables.piMix(...)", where tables is CryptonTables, a plain object
        // literal (never blessed) whose gammaTau/piMix/phi0/phi1 properties
        // hold coderefs to locally-scoped arrow functions. Falling through
        // to the generic "$object->method(@args)" method-call emission just
        // below would be a real Perl method dispatch, which dies "Can't call
        // method ... on unblessed reference" - the coderef must instead be
        // deref-called: "$object->{'method'}->(@args)".
        if (this.objectCoderefPropNames && this.objectCoderefPropNames.has(method)) {
          return new PerlMemberAccess(
            new PerlSubscript(object, PerlLiteral.String(method, "'"), 'hash', true),
            new PerlCall(null, args),
            '->'
          );
        }

        const call = new PerlCall(new PerlIdentifier(method), args);
        call.isMethodCall = true;

        // Create method call: $object->method(@args)
        return new PerlMemberAccess(object, call, '->');
      }

      // Handle global JavaScript functions (not method calls)
      if (node.callee.type === 'Identifier') {
        const funcName = node.callee.name;
        const args = node.arguments.map(arg => this.transformExpression(arg));

        // Array(n) called as function (without new) - same as new Array(n)
        // Creates an array of n undefined elements: [(undef) x $n]
        if (funcName === 'Array') {
          if (args.length === 1) {
            // Array(n) -> [(undef) x n]
            return new PerlArray([
              new PerlBinaryExpression(
                new PerlGrouped(new PerlIdentifier('undef')),
                'x',
                args[0]
              )
            ]);
          }
          // Array(a, b, c) -> [a, b, c]
          return new PerlArray(args);
        }

        // parseInt(x, radix) -> int($x), or hex()/oct() for a literal
        // 16/8/2 radix - dropping the radix entirely (as a plain int($x))
        // silently corrupted every non-decimal parseInt() call (e.g.
        // parseInt(byteStr, 2) parsing a binary digit string as decimal).
        if (funcName === 'parseInt') {
          const radixArg = node.arguments[1];
          if (radixArg && radixArg.type === 'Literal' && typeof radixArg.value === 'number') {
            const radix = radixArg.value;
            if (radix === 16) return new PerlCall('hex', [args[0]]);
            if (radix === 8) return new PerlCall('oct', [args[0]]);
            if (radix === 2) return new PerlCall('oct', [new PerlBinaryExpression(PerlLiteral.String('0b', "'"), '.', args[0])]);
          }
          return new PerlCall('int', [args[0]]);
        }

        // parseFloat(x) -> $x + 0
        if (funcName === 'parseFloat') {
          return new PerlBinaryExpression(args[0], '+', new PerlLiteral(0));
        }

        // isNaN(x) -> (!defined($x) || $x ne $x)
        if (funcName === 'isNaN') {
          const notDefined = new PerlUnaryExpression('!', new PerlCall('defined', [args[0]]), true);
          const neCheck = new PerlBinaryExpression(args[0], 'ne', args[0]);
          return new PerlGrouped(new PerlBinaryExpression(notDefined, '||', neCheck));
        }

        // isFinite(x) -> defined($x)
        if (funcName === 'isFinite') {
          return new PerlCall('defined', [args[0]]);
        }

        // Number(x) -> numeric coercion (JS ToNumber). Perl scalars are
        // already dual string/number, but "0 + $x" forces numeric context
        // the same way JS's Number() does, rather than emitting a bareword
        // call to a nonexistent &Number sub (Perl has no such builtin).
        if (funcName === 'Number' && args.length === 1) {
          return new PerlGrouped(new PerlBinaryExpression(PerlLiteral.Number(0), '+', args[0]));
        }

        // String(x) -> stringification (JS ToString), mirroring Perl's
        // implicit string context via concatenation with an empty string.
        if (funcName === 'String' && args.length === 1) {
          return new PerlGrouped(new PerlBinaryExpression(PerlLiteral.String('', "'"), '.', args[0]));
        }

        // Boolean(x) -> truthiness coercion via double negation.
        if (funcName === 'Boolean' && args.length === 1) {
          return new PerlUnaryExpression('!!', args[0], true);
        }

        // encodeURIComponent -> use URI::Escape 'uri_escape'
        if (funcName === 'encodeURIComponent') {
          this.addRequiredModule('URI::Escape', 'uri_escape');
          return new PerlCall('uri_escape', args);
        }

        // decodeURIComponent -> use URI::Escape 'uri_unescape'
        if (funcName === 'decodeURIComponent') {
          this.addRequiredModule('URI::Escape', 'uri_unescape');
          return new PerlCall('uri_unescape', args);
        }

        // Check if this is a code reference variable (assigned from function expression)
        // In Perl, code refs must be called with $coderef->() syntax
        if (this.codeRefVariables.has(funcName)) {
          // A nested function's Perl variable may have been uniquely renamed
          // (see _collectNestedFunctionRenames' doc comment).
          const coderefName = this.nestedFunctionNames.has(funcName) ? this._resolveNestedFunctionName(funcName) : funcName;
          return new PerlCall(new PerlIdentifier(coderefName, '$'), args);
        }

        // Regular function call with Perl identifier. Known top-level JS
        // helper functions are emitted as top-level Perl subs, which
        // always land in "package main" (see PerlEmitter.js emitModule) -
        // qualify the call so it still resolves from inside a class's
        // "package Foo;" block, which is virtually every call site here.
        // A NESTED function (see nestedFunctionNames' doc comment) instead
        // compiles into whichever package the enclosing method belongs to,
        // so it must stay unqualified.
        if (this.functionNames.has(funcName) && !this.nestedFunctionNames.has(funcName)) {
          return new PerlCall(new PerlIdentifier('main::' + funcName), args);
        }
        // See _collectNestedFunctionRenames' doc comment - a nested
        // function's Perl sub may have been given a unique per-method name.
        const nestedCallee = this.nestedFunctionNames.has(funcName) ? this._resolveNestedFunctionName(funcName) : funcName;
        return new PerlCall(new PerlIdentifier(nestedCallee), args);
      }

      // Handle IIFE (Immediately Invoked Function Expression)
      // Pattern: (function() {...})() or (() => {...})()
      // In Perl, this needs to be: (sub { ... })->()
      if (node.callee.type === 'ArrowFunctionExpression' || node.callee.type === 'ArrowFunction' ||
          node.callee.type === 'FunctionExpression') {
        const anonSub = this.transformFunctionExpression(node.callee);
        const args = node.arguments.map(arg => this.transformExpression(arg));
        // Create IIFE: (sub { ... })->(args)
        const grouped = new PerlGrouped(anonSub);
        const methodCall = new PerlMemberAccess(grouped, new PerlCall(null, args), '->');
        return methodCall;
      }

      // Regular function call
      // For known function names, use the fully qualified main:: name.
      // Top-level JS helper functions are emitted as top-level Perl subs,
      // which always land in "package main" (see PerlEmitter.js emitModule);
      // a bareword call to one from inside a class's "package Foo;" block
      // (virtually every call site, since almost all code here lives
      // inside Instance/Algorithm methods) would otherwise resolve against
      // Foo:: and fail with "Undefined subroutine". A NESTED function (see
      // nestedFunctionNames' doc comment) instead compiles into whichever
      // package the enclosing method belongs to, so it must stay
      // unqualified - "main::" there names a sub that was never defined.
      if (node.callee.type === 'Identifier' && this.functionNames.has(node.callee.name)) {
        const args = node.arguments.map(arg => this.transformExpression(arg));
        // Nested case: call it bare (unqualified) - NOT via the generic
        // "const callee = this.transformExpression(node.callee);" fallback
        // further below, which (through transformIdentifier's code-ref
        // branch, meant for a function name used as a *value*) would wrap
        // it as "\&funcName" instead of a callable bareword, producing
        // invalid call syntax like "(\&stateToBytes)(args)".
        const calleeName = this.nestedFunctionNames.has(node.callee.name) ? this._resolveNestedFunctionName(node.callee.name) : ('main::' + node.callee.name);
        return new PerlCall(new PerlIdentifier(calleeName, ''), args);
      }

      // A non-computed MemberExpression callee being invoked - obj.method(args) -
      // is unambiguously a method call, regardless of the property name.
      // Build it directly as $obj->method(args) rather than routing through
      // transformMemberExpression, whose generic (non-call) fallback is
      // tuned for bare property reads (see transformMemberExpression) and
      // would otherwise need the property name on its dataProperties
      // allowlist to avoid misreading it as a method.
      if (node.callee.type === 'MemberExpression' && !node.callee.computed &&
          node.callee.object?.type !== 'ThisExpression') {
        const methodName = node.callee.property.name || node.callee.property.value;
        if (methodName && methodName !== 'length') {
          const objExpr = this.transformExpression(node.callee.object);
          const args = node.arguments.map(arg => this.transformExpression(arg));
          return new PerlMemberAccess(objExpr, new PerlCall(new PerlIdentifier(methodName), args), '->');
        }
      }

      const callee = this.transformExpression(node.callee);
      const args = node.arguments.map(arg => this.transformExpression(arg));

      return new PerlCall(callee, args);
    }

    /**
     * Transform OpCodes method calls to Perl equivalents
     */
    transformOpCodesCall(node) {
      const methodName = node.callee.property.name;
      const args = node.arguments.map(arg => this.transformExpression(arg));

      // Map common OpCodes methods to Perl equivalents inline

      // CopyArray - shallow copy
      if (methodName === 'CopyArray')
        return new PerlArray([new PerlUnaryExpression('@', args[0], true)]);

      // FillArray - fill array with value
      if (methodName === 'FillArray' || methodName === 'Fill') {
        // @{$arr} = ($val) x $count
        return new PerlArray([
          new PerlBinaryExpression(
            new PerlGrouped(args[1] || args[0]),
            'x',
            args[2] || args[1] || PerlLiteral.Number(1)
          )
        ]);
      }

      // BitMask - create a bitmask with n bits set
      if (methodName === 'BitMask')
        return new PerlBinaryExpression(
          new PerlBinaryExpression(PerlLiteral.Number(1), '<<', args[0]),
          '-',
          PerlLiteral.Number(1)
        );

      // CompareArrays - compare two arrays
      if (methodName === 'CompareArrays') {
        // join('', @$a) eq join('', @$b)
        const joinA = new PerlCall('join', [PerlLiteral.String('', "'"), new PerlUnaryExpression('@', args[0], true)]);
        const joinB = new PerlCall('join', [PerlLiteral.String('', "'"), new PerlUnaryExpression('@', args[1], true)]);
        return new PerlBinaryExpression(joinA, 'eq', joinB);
      }

      // CreateBitStream - returns a stateful bit-level I/O object (see
      // e.g. compression/golomb-bitstream.js's "OpCodes.CreateBitStream()",
      // later called as "stream.writeBits(...)"/"stream.readByte()"/...).
      // Unlike every other entry in this function (a plain value-in,
      // value-out helper backed by a lowercase OpCodes::<name> sub), this
      // one needs a real blessed OBJECT with its OWN methods - construct
      // it via the dedicated _OpCodesBitStream package (see
      // PerlEmitter.js's emitBitStreamClass) instead of the generic
      // fallback below, which would otherwise try (and fail) to call a
      // plain "OpCodes::createbitstream(...)" sub that returns a bare
      // value with no methods of its own.
      if (methodName === 'CreateBitStream') {
        this.usesBitStreamClass = true;
        const newCall = new PerlCall(new PerlIdentifier('new'), args);
        newCall.isMethodCall = true;
        return new PerlMemberAccess(new PerlIdentifier('_OpCodesBitStream', ''), newCall, '->');
      }

      // Default: prefix with OpCodes:: package name so Perl can find it.
      // This ensures that any OpCodes method not specially handled inline
      // above is still callable, backed by a small runtime package (see
      // PerlEmitter.js emitOpCodesRuntimeStub) covering the OpCodes.js
      // functions this codebase actually calls that don't reduce to a
      // simple inline Perl expression (GetByte, GetBit, GF256Mul, ...).
      // Flag so the emitter knows to emit that package.
      this.usesOpCodesRuntimeFallback = true;
      // RotL128n/RotR128n (block/present.js's PRESENT-128 key-schedule
      // rotate, and any other genuinely-128-bit rotate) are backed by a
      // Math::BigInt-based runtime stub (see PerlEmitter.js
      // emitOpCodesRuntimeStub's "rotl128n"/"rotr128n" entries) - unlike
      // the 64-bit rotl64n/rotr64n stubs (plain native-integer arithmetic,
      // no module needed), 128 bits exceeds a native Perl integer and the
      // stub body itself calls Math::BigInt->new(...). Ensure the "use
      // Math::BigInt;" line is emitted even for a file whose ONLY
      // wide-arithmetic need is this one rotate (every other Math::BigInt
      // trigger in this file lives in transformBinaryExpression/
      // transformAssignmentExpression, which this call-only code path
      // doesn't go through).
      if (methodName === 'RotL128n' || methodName === 'RotR128n') this.addRequiredModule('Math::BigInt');
      return new PerlCall(new PerlMemberAccess(new PerlIdentifier('OpCodes'), new PerlIdentifier(methodName.toLowerCase()), '::'), args);
    }

    /**
     * Transform array.reduce() to inline Perl reduction
     * JS: array.reduce((acc, elem) => acc + elem, initialValue)
     * Perl: do { my $acc = init; for my $x (@{$array}) { $acc = expr } $acc }
     */
    transformArrayReduce(node) {
      const array = this.transformExpression(node.callee.object);
      const callback = node.arguments[0];
      const initialValue = node.arguments.length > 1
        ? this.transformExpression(node.arguments[1])
        : PerlLiteral.Number(0);

      if (!callback || (callback.type !== 'ArrowFunctionExpression' && callback.type !== 'ArrowFunction' && callback.type !== 'FunctionExpression')) {
        // Fallback to method call if callback is not a function literal
        const args = node.arguments.map(arg => this.transformExpression(arg));
        const call = new PerlCall(new PerlIdentifier('reduce'), args);
        call.isMethodCall = true;
        return new PerlMemberAccess(array, call, '->');
      }

      // Get parameter names from callback
      const params = callback.params || [];
      const accName = params[0]?.name || 'acc';
      const elemName = params[1]?.name || 'elem';

      // Transform callback body with substitution
      const bodyExpr = this.transformReduceBody(callback.body, accName, elemName);

      // Create inline do block structure
      const reduceBlock = {
        nodeType: 'ReduceBlock',
        array: array,
        initialValue: initialValue,
        bodyExpr: bodyExpr
      };

      return reduceBlock;
    }

    /**
     * Transform reduce callback body, replacing acc/elem with $acc/$x
     */
    transformReduceBody(body, accName, elemName) {
      if (!body) return PerlLiteral.Number(0);

      // If expression body (arrow function shorthand)
      if (body.type !== 'BlockStatement') {
        return this.transformWithSubst(body, accName, elemName);
      }

      // Block body - find return statement
      const statements = body.body || [];
      for (const stmt of statements) {
        if (stmt.type === 'ReturnStatement' && stmt.argument) {
          return this.transformWithSubst(stmt.argument, accName, elemName);
        }
      }

      return PerlLiteral.Number(0);
    }

    /**
     * Transform expression with accumulator/element substitution for reduce
     */
    transformWithSubst(node, accName, elemName) {
      if (!node) return null;

      if (node.type === 'Identifier') {
        if (node.name === accName) {
          return new PerlIdentifier('acc', '$');
        }
        if (node.name === elemName) {
          return new PerlIdentifier('x', '$');
        }
        return this.transformExpression(node);
      }

      if (node.type === 'BinaryExpression' || node.type === 'LogicalExpression') {
        const left = this.transformWithSubst(node.left, accName, elemName);
        const right = this.transformWithSubst(node.right, accName, elemName);
        return new PerlBinaryExpression(left, node.operator, right);
      }

      if (node.type === 'UnaryExpression') {
        const operand = this.transformWithSubst(node.argument, accName, elemName);
        return new PerlUnaryExpression(node.operator, operand, node.prefix);
      }

      if (node.type === 'Literal') {
        return this.transformLiteral(node);
      }

      if (node.type === 'ConditionalExpression') {
        const test = this.transformWithSubst(node.test, accName, elemName);
        const consequent = this.transformWithSubst(node.consequent, accName, elemName);
        const alternate = this.transformWithSubst(node.alternate, accName, elemName);
        return new PerlConditional(test, consequent, alternate);
      }

      // Fallback to regular transform
      return this.transformExpression(node);
    }

    /**
     * Transform an array expression
     */
    transformArrayExpression(node) {
      const elements = node.elements.map(elem => this.transformExpression(elem));
      return new PerlArray(elements);
    }

    /**
     * Transform an object expression to Perl hash
     */
    transformObjectExpression(node) {
      // Pre-group get/set accessor properties by key - see the matching (and
      // more extensively commented) fix in the 'ObjectLiteral' IL case of
      // transformExpression / transformObjectAccessorPair. This legacy
      // (non-IL) path handles the same raw ESTree property shape
      // ({key, value, kind}), so it's exposed to the identical
      // duplicate-hash-key accessor-clobbering bug.
      const accessorGroups = new Map();
      for (const prop of node.properties) {
        if (!prop.key) continue;
        if (prop.kind !== 'get' && prop.kind !== 'set') continue;
        const key = this._normalizeLiteralObjectKey(prop.key.name || prop.key.value || 'unknown');
        let group = accessorGroups.get(key);
        if (!group) { group = { get: null, set: null }; accessorGroups.set(key, group); }
        group[prop.kind] = prop;
      }

      const pairs = [];
      let hasFunctionProperty = false;
      const emittedAccessorKeys = new Set();
      for (const prop of node.properties) {
        if (!prop.key) continue;

        const key = this._normalizeLiteralObjectKey(prop.key.name || prop.key.value || 'unknown');

        if (prop.kind === 'get' || prop.kind === 'set') {
          if (emittedAccessorKeys.has(key)) continue;
          emittedAccessorKeys.add(key);
          hasFunctionProperty = true;
          const group = accessorGroups.get(key);
          const combined = this.transformObjectAccessorPair(group.get, group.set);
          pairs.push({ key, value: combined });
          continue;
        }

        // Check if the value is an identifier that refers to a known function
        // In Perl, we need to use code references: \&funcName
        if (prop.value && prop.value.type === 'Identifier' &&
            this.functionNames.has(prop.value.name)) {
          // Create a code reference: \&funcName
          const codeRef = new PerlUnaryExpression('\\&', new PerlIdentifier(prop.value.name, ''), true);
          pairs.push({ key, value: codeRef });
        } else {
          const isFuncProp = prop.value && (prop.value.type === 'FunctionExpression' ||
              prop.value.type === 'ArrowFunctionExpression' || prop.value.type === 'ArrowFunction');
          if (isFuncProp) hasFunctionProperty = true;
          // See the matching comment in the 'ObjectLiteral' IL case / the
          // forceSelf comment in transformFunctionExpression.
          if (isFuncProp) this._forceSelfParam = true;
          const value = this.transformExpression(prop.value);
          pairs.push({ key, value });
        }
      }

      const hash = new PerlHash(pairs);
      // Legacy "const X = { name: ..., CreateInstance: function(){...}, ... }"
      // algorithm-object literals (as opposed to plain data objects like test
      // vectors) carry at least one method as a function-valued property -
      // bless the hashref into _LegacyAlgoObj so the harness's/other code's
      // "$x->Method(...)" call syntax dispatches to that coderef instead of
      // dying with "Can't call method ... on unblessed reference" (see
      // module.usesLegacyAlgoObj / PerlEmitter's _LegacyAlgoObj stub).
      if (hasFunctionProperty) {
        this.usesLegacyAlgoObj = true;
        return new PerlBless(hash, '_LegacyAlgoObj');
      }
      return hash;
    }

    /**
     * Transform a new expression
     */
    transformNewExpression(node) {
      // Handle MemberExpression callees like AlgorithmFramework.KeySize
      if (node.callee.type === 'MemberExpression') {
        const args = node.arguments.map(arg => this.transformExpression(arg));

        // Handle AlgorithmFramework.ClassName pattern
        if (node.callee.object.type === 'Identifier' &&
            node.callee.object.name === 'AlgorithmFramework') {
          const typeName = node.callee.property.name || node.callee.property.value;

          // Class instantiation: ClassName->new(@args)
          const newCall = new PerlCall(new PerlIdentifier('new'), args);
          newCall.isMethodCall = true;
          return new PerlMemberAccess(new PerlIdentifier(typeName), newCall, '->');
        }

        // For other MemberExpression callees, transform the callee and call ->new()
        const callee = this.transformExpression(node.callee);
        const newCall = new PerlCall(new PerlIdentifier('new'), args);
        newCall.isMethodCall = true;
        return new PerlMemberAccess(callee, newCall, '->');
      }

      if (node.callee.type === 'Identifier') {
        const typeName = node.callee.name;
        const args = node.arguments.map(arg => this.transformExpression(arg));

        // Handle Error constructor - just return the message for use with die
        if (typeName === 'Error' || typeName === 'TypeError' || typeName === 'RangeError') {
          // new Error('message') -> 'message' (to be used with die)
          return args.length > 0 ? args[0] : PerlLiteral.String('Error', "'");
        }

        // Handle TypedArrays -> pack/unpack or Array::Typed
        if (typeName === 'Uint8Array' || typeName === 'Uint32Array') {
          // new Uint8Array([...]) -> pack or array
          return new PerlArray(args);
        }

        // Handle Array constructor
        if (typeName === 'Array') {
          return new PerlArray(args);
        }

        // Class instantiation: ClassName->new(@args)
        const newCall = new PerlCall(new PerlIdentifier('new'), args);
        newCall.isMethodCall = true;
        return new PerlMemberAccess(new PerlIdentifier(typeName), newCall, '->');
      }

      return null;
    }

    /**
     * Transform a conditional expression (ternary)
     */
    transformConditionalExpression(node) {
      // Collapse ternaries where the test is AlgorithmFramework (always truthy in transpiled code)
      const testName = node.test?.name || node.test?.object?.name;
      if (testName === 'AlgorithmFramework' || testName === 'global' || testName === 'globalThis') {
        const isBareNamespaceTest = node.test?.type === 'Identifier';
        const testPropName = node.test?.property?.name || node.test?.property?.value;
        // "global.AlgorithmFramework ? ... : ..." / "globalThis.AlgorithmFramework
        // ? ... : ..." - testing the framework namespace's own presence
        // (always true in bundled Perl), not one of its members.
        const isFrameworkPresenceCheck = testPropName === 'AlgorithmFramework';
        // A handful of AlgorithmFramework members are unconditionally
        // emitted by every generated Perl module (the RegisterAlgorithm/Find
        // stub, every class's CreateInstance) and can never legitimately be
        // missing - a duck-typing "AlgorithmFramework.Find ? ..." guard for
        // THESE is always true. Any OTHER member (e.g. "GetRegistry" - not
        // part of this codebase's actual framework contract; the real JS
        // AlgorithmFramework has no such method either) must NOT be assumed
        // present just because its *receiver* happens to be the framework
        // namespace - see algorithms/mac/dstu7624mac.js's getKalyna(), whose
        // "AlgorithmFramework.GetRegistry ? AlgorithmFramework.GetRegistry()
        // : null" used to collapse unconditionally to the consequent,
        // calling a Perl sub that was never stubbed and dying inside the
        // eval-wrapped property setter that invoked it (silently leaving
        // the rest of that setter's work undone - the caller only ever saw
        // a downstream "not initialized" symptom, never this die).
        const ALWAYS_PRESENT_FRAMEWORK_MEMBERS = new Set(['Find', 'RegisterAlgorithm', 'CreateInstance']);
        const isKnownMemberCheck = testName === 'AlgorithmFramework' && ALWAYS_PRESENT_FRAMEWORK_MEMBERS.has(testPropName);
        if (isBareNamespaceTest || isFrameworkPresenceCheck || isKnownMemberCheck)
          return this.transformExpression(node.consequent);
        // An unrecognized "AlgorithmFramework.<member> ? ... : ..." existence
        // probe: use Perl's own $pkg->can('member') rather than assuming
        // either way.
        if (testName === 'AlgorithmFramework' && testPropName && node.test.type === 'MemberExpression' && !node.test.computed) {
          const objExpr = this.transformExpression(node.test.object);
          const canCall = new PerlCall(new PerlIdentifier('can'), [PerlLiteral.String(testPropName, "'")]);
          canCall.isMethodCall = true;
          const condition = new PerlMemberAccess(objExpr, canCall, '->');
          return new PerlConditional(condition, this.transformExpression(node.consequent), this.transformExpression(node.alternate));
        }
      }

      // Collapse typeof X !== 'undefined' ? X : fallback for known packages
      // These always exist in transpiled Perl code
      if (node.test?.type === 'BinaryExpression' &&
          (node.test.operator === '!==' || node.test.operator === '!=' ||
           node.test.operator === '===' || node.test.operator === '==')) {
        const isNeq = node.test.operator === '!==' || node.test.operator === '!=';
        let typeofArg = null;
        let comparedValue = null;
        if (node.test.left?.type === 'UnaryExpression' && node.test.left.operator === 'typeof') {
          typeofArg = node.test.left.argument?.name;
          comparedValue = node.test.right?.value;
        } else if (node.test.right?.type === 'UnaryExpression' && node.test.right.operator === 'typeof') {
          typeofArg = node.test.right.argument?.name;
          comparedValue = node.test.left?.value;
        // Also detect IL TypeOfExpression nodes
        } else if (node.test.left?.type === 'TypeOfExpression' || node.test.left?.ilNodeType === 'TypeOfExpression') {
          typeofArg = node.test.left.value?.name || node.test.left.argument?.name;
          comparedValue = node.test.right?.value;
        } else if (node.test.right?.type === 'TypeOfExpression' || node.test.right?.ilNodeType === 'TypeOfExpression') {
          typeofArg = node.test.right.value?.name || node.test.right.argument?.name;
          comparedValue = node.test.left?.value;
        }
        if (typeofArg && comparedValue === 'undefined') {
          const knownDefined = new Set([
            'OpCodes', 'AlgorithmFramework', 'RegisterAlgorithm', 'CategoryType',
            'SecurityStatus', 'ComplexityType', 'CountryCode', 'LinkItem', 'KeySize',
            'TestCase', 'Vulnerability', 'Math', 'JSON', 'console', 'Object', 'Array',
            'String', 'Number', 'Uint8Array', 'Int8Array', 'Uint16Array', 'Int16Array',
            'Uint32Array', 'Int32Array', 'Float32Array', 'Float64Array', 'ArrayBuffer',
            'DataView', 'require', 'module', 'exports'
          ]);
          if (knownDefined.has(typeofArg)) {
            // typeof KnownPkg !== 'undefined' ? consequent : alternate
            // Always true -> pick consequent (for !==), alternate (for ===)
            return this.transformExpression(isNeq ? node.consequent : node.alternate);
          }
          const knownUndefined = new Set([
            'window', 'document', 'navigator', 'performance', 'self',
            'global', 'globalThis', 'process', 'TextEncoder', 'TextDecoder',
            'Buffer', 'Crypto', 'crypto'
          ]);
          if (knownUndefined.has(typeofArg)) {
            // typeof browserGlobal !== 'undefined' ? consequent : alternate
            // Always false -> pick alternate (for !==), consequent (for ===)
            return this.transformExpression(isNeq ? node.alternate : node.consequent);
          }
        }
      }

      // Collapse logical AND checks: AlgorithmFramework && AlgorithmFramework.Find
      if (node.test?.type === 'LogicalExpression' && node.test.operator === '&&') {
        const leftName = node.test.left?.name || node.test.left?.argument?.name;
        if (leftName === 'AlgorithmFramework' || leftName === 'OpCodes')
          return this.transformExpression(node.consequent);
      }

      const condition = this.transformExpression(node.test);
      const consequent = this.transformExpression(node.consequent);
      const alternate = this.transformExpression(node.alternate);

      return new PerlConditional(condition, consequent, alternate);
    }

    /**
     * Transform a function expression to Perl anonymous subroutine
     */
    /**
     * Recursively scan a function body for a CallExpression whose callee is
     * a bare Identifier matching one of this function's OWN parameter
     * names (paramNames) - see the doc comment at its call site in
     * transformFunctionExpression for why that means the parameter holds
     * a code reference. Does not descend into a nested function/arrow
     * expression's OWN body if that nested function redeclares one of the
     * same names as its own parameter (that inner shadowed name is a
     * separate binding, resolved independently were it ever transformed).
     * @param {Set<string>} paramNames
     * @param {object} node
     * @param {Set<string>} [found]
     * @returns {Set<string>}
     */
    _findParamsCalledAsFunctions(paramNames, node, found) {
      found = found || new Set();
      if (!node || typeof node !== 'object') return found;
      if (Array.isArray(node)) {
        for (const n of node) this._findParamsCalledAsFunctions(paramNames, n, found);
        return found;
      }
      if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && paramNames.has(node.callee.name))
        found.add(node.callee.name);
      const isNestedFunction = node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression' ||
        node.type === 'ArrowFunction' || node.type === 'FunctionDeclaration';
      const shadowedNames = isNestedFunction && node.params
        ? new Set(node.params.map(p => p.name || (p.left && p.left.name) || (p.id && p.id.name)).filter(Boolean))
        : null;
      const innerParamNames = shadowedNames && shadowedNames.size > 0
        ? new Set([...paramNames].filter(n => !shadowedNames.has(n)))
        : paramNames;
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === '_parent') continue;
        this._findParamsCalledAsFunctions(innerParamNames, node[key], found);
      }
      return found;
    }

    transformFunctionExpression(node) {
      // Map parameters - always use $ to avoid slurpy issues
      const params = node.params ? node.params.map(p => {
        let paramName, defaultValue = null;
        // Handle various parameter formats from IL/AST
        if (p.type === 'AssignmentPattern') {
          paramName = p.left && p.left.name;
          defaultValue = p.right ? this.transformExpression(p.right) : null;
        } else if (p.defaultValue !== undefined && p.defaultValue !== null) {
          paramName = p.name || (p.left && p.left.name) || (p.id && p.id.name);
          defaultValue = this.transformExpression(p.defaultValue);
        } else {
          paramName = p.name || (p.left && p.left.name) || (p.id && p.id.name);
          // JS allows calling with fewer args than declared (missing ones become undefined);
          // Perl signatures require an explicit default to permit that.
          defaultValue = PerlLiteral.Undef();
        }
        if (!paramName) paramName = '_arg' + params.length;
        // $_ is a special variable in Perl - cannot be used as a formal parameter in signatures
        if (paramName === '_') paramName = '_unused';
        // Always use $ for function parameters and register so body references use correct sigil
        this.registerVariableType(paramName, '$');
        return new PerlParameter(paramName, '$', null, defaultValue);
      }) : [];

      // Check if body references 'this' (ThisExpression/ThisPropertyAccess/ThisMethodCall)
      // and $self is not already declared as a parameter
      const hasSelfParam = params.some(p => p.name === 'self');
      // _forceSelfParam: set by the ObjectLiteral/ObjectExpression property
      // transform (see transformObjectExpression/'ObjectLiteral' case) for
      // the direct method-value functions of a legacy "const X = {...}"
      // algorithm object. Every internal call to one of these is written as
      // "this.foo(...)" in the source and thus always transpiles to a
      // "$self->foo(...)" method call (dispatched through the _LegacyAlgoObj
      // AUTOLOAD stub, which always passes $self as the first argument
      // regardless of whether the target coderef's own body happens to
      // reference 'this') - so the coderef must always declare $self first,
      // even when its body doesn't use 'this' (e.g. a pure helper like
      // "bytesToWord64LE(bytes, offset)" still called as
      // "this.bytesToWord64LE(...)"), or the call arity mismatches
      // ("Too many/few arguments for subroutine"). Consumed (and reset for
      // any nested function expressions in the body, which follow the normal
      // usage-based heuristic) immediately below.
      const forceSelf = this._forceSelfParam;
      this._forceSelfParam = false;
      const bodyUsesThis = !hasSelfParam && (forceSelf || this._bodyUsesThis(node.body));

      // A parameter that this function's OWN body calls directly as
      // "paramName(...)" (e.g. mac/ttmac.js's "const subround = (fn, s, a,
      // b, c, d, e, x, k) => { ...fn(b, c, d)... };", where "fn" is one of
      // 4 interchangeable round functions passed in by each caller) holds a
      // code reference, not a plain scalar - needs "$paramName->(...)" call
      // syntax, exactly like codeRefVariables already ensures for a
      // directly-assigned arrow/function-expression LET/CONST variable.
      // Without this, the call fell through to a bareword sub call
      // ("fn(...)"), which Perl resolves against the CURRENT PACKAGE (the
      // enclosing class, since this arrow function is itself a method/
      // field body) rather than dereferencing the parameter, dying
      // "Undefined subroutine &SomeClassInstance::fn called" (no such sub
      // was ever defined - "fn" only ever existed as a runtime coderef
      // value passed in by the caller). Scoped to just this function's own
      // body/params and restored afterward so it doesn't leak into
      // sibling/enclosing scopes that might reuse the same parameter name
      // for an ordinary (non-callable) value.
      const paramNameSet = new Set(params.map(pm => pm.name));
      const calledAsFunctionParams = this._findParamsCalledAsFunctions(paramNameSet, node.body);
      const addedCodeRefParams = [];
      for (const pname of calledAsFunctionParams) {
        if (!this.codeRefVariables.has(pname)) {
          this.codeRefVariables.add(pname);
          addedCodeRefParams.push(pname);
        }
      }

      // Transform body - see _transformFunctionScopeBody's doc comment
      // (SCOPED registration of any nested declarations this function/arrow
      // body itself declares, plus the "my $name;" pre-declaration hoist).
      let body = null;
      if (node.body) {
        if (node.body.type === 'BlockStatement') {
          body = this._transformFunctionScopeBody(node.body);
        } else {
          // Arrow function with expression body
          body = new PerlBlock();
          body.statements.push(new PerlReturn(this.transformExpression(node.body)));
        }
      }

      for (const pname of addedCodeRefParams) this.codeRefVariables.delete(pname);

      // Add $self as first parameter if this is used without $self param
      // (avoids conflict with 'use feature "signatures"' - shift() is forbidden in signature-enabled subs).
      //
      // Skipped for a genuine arrow function (unless forceSelf, the legacy-
      // object-literal AUTOLOAD-dispatch case documented above, which needs
      // an explicit $self regardless of syntax) - unlike a plain
      // "function(){}" expression, a JS arrow function has no "this" of its
      // own; it lexically captures the *enclosing* this, exactly like Perl
      // closures already lexically capture an enclosing "my"/signature-bound
      // $self with no extra parameter needed. Unshifting $self here anyway
      // - as if this were a real method - shifted every real argument at the
      // call site over by one position instead (whatever the caller passed
      // as the closure's first argument silently became $self, so e.g. a
      // "const hmacFunc = this._getHMACFunction(); hmacFunc(key, message);"
      // closure got $key bound to its *own* $self parameter, then died
      // calling a method on it: "Can't call method ... on unblessed
      // reference"). The outer method's own $self remains directly visible
      // inside thanks to ordinary Perl closure capture.
      const isArrowFn = node.type === 'ArrowFunctionExpression' || node.type === 'ArrowFunction';
      if (bodyUsesThis && (forceSelf || !isArrowFn)) {
        params.unshift(new PerlParameter('self', '$'));
      }

      return new PerlAnonSub(params, body);
    }

    /**
     * Check if a test condition is a framework-availability guard
     * (typeof AlgorithmFramework !== 'undefined', typeof OpCodes !== 'undefined', etc.)
     */
    _isFrameworkGuard(test) {
      if (!test) return false;
      const knownDefined = new Set([
        'OpCodes', 'AlgorithmFramework', 'RegisterAlgorithm', 'CategoryType',
        'SecurityStatus', 'ComplexityType', 'CountryCode', 'require', 'module'
      ]);

      // typeof X !== 'undefined'
      if (test.type === 'BinaryExpression' &&
          (test.operator === '!==' || test.operator === '!=')) {
        if (test.left?.type === 'UnaryExpression' && test.left.operator === 'typeof' &&
            knownDefined.has(test.left.argument?.name) &&
            test.right?.value === 'undefined')
          return true;
        if (test.right?.type === 'UnaryExpression' && test.right.operator === 'typeof' &&
            knownDefined.has(test.right.argument?.name) &&
            test.left?.value === 'undefined')
          return true;
      }

      // typeof X !== 'undefined' && X.Prop (LogicalExpression with &&)
      if (test.type === 'LogicalExpression' && test.operator === '&&') {
        // "OpCodes && OpCodes.<OptionalMethod>" where <OptionalMethod> is
        // verifiably absent from the real OpCodes module is an always-false
        // guard (see _isFalseGuard's matching case), not an always-true
        // one - checked first so it isn't shadowed by the blanket
        // bare-"OpCodes" rule below.
        if (this._isFalseGuard(test)) return false;
        if (this._isFrameworkGuard(test.left)) return true;
        // Also check for bare AlgorithmFramework or OpCodes as the left operand
        if (knownDefined.has(test.left?.name)) return true;
      }

      return false;
    }

    /**
     * Check if a test condition is a browser/JS-only-global availability guard
     * that is always false in transpiled Perl code, e.g.:
     *   typeof crypto !== 'undefined'
     *   typeof crypto !== 'undefined' && crypto.getRandomValues
     * These globals (crypto, window, document, Buffer, ...) never exist in
     * standalone Perl output, so referencing them directly (even inside a
     * dead branch) would fail "use strict" symbol resolution at compile
     * time. Detecting this lets transformIfStatement skip the branch
     * entirely instead of emitting a reference to an undeclared variable.
     */
    _isFalseGuard(test) {
      if (!test) return false;
      const knownUndefined = new Set([
        'window', 'document', 'navigator', 'performance', 'self',
        'global', 'globalThis', 'process', 'TextEncoder', 'TextDecoder',
        'Buffer', 'Crypto', 'crypto'
      ]);

      // typeof X !== 'undefined'
      if (test.type === 'BinaryExpression' &&
          (test.operator === '!==' || test.operator === '!=')) {
        if (test.left?.type === 'UnaryExpression' && test.left.operator === 'typeof' &&
            knownUndefined.has(test.left.argument?.name) &&
            test.right?.value === 'undefined')
          return true;
        if (test.right?.type === 'UnaryExpression' && test.right.operator === 'typeof' &&
            knownUndefined.has(test.right.argument?.name) &&
            test.left?.value === 'undefined')
          return true;
        // Also detect IL TypeOfExpression nodes
        if ((test.left?.type === 'TypeOfExpression' || test.left?.ilNodeType === 'TypeOfExpression') &&
            knownUndefined.has(test.left.value?.name || test.left.argument?.name) &&
            test.right?.value === 'undefined')
          return true;
        if ((test.right?.type === 'TypeOfExpression' || test.right?.ilNodeType === 'TypeOfExpression') &&
            knownUndefined.has(test.right.value?.name || test.right.argument?.name) &&
            test.left?.value === 'undefined')
          return true;
      }

      // Bare reference to a known-undefined global, e.g. `if (crypto) { ... }`
      if (test.type === 'Identifier' && knownUndefined.has(test.name))
        return true;

      // typeof X !== 'undefined' && X.Prop (LogicalExpression with &&) - if the
      // left side is always false, the whole conjunction is always false.
      if (test.type === 'LogicalExpression' && test.operator === '&&') {
        if (this._isFalseGuard(test.left)) return true;

        // "OpCodes && OpCodes.<Method>" - a "maybe this optional helper
        // exists?" feature-detection idiom (e.g. sp800-108-*.js/hotp.js/
        // totp.js's "if (OpCodes && OpCodes.HMAC) { return OpCodes.HMAC(...)
        // }" fallback chain). _isFrameworkGuard's bare-"OpCodes"-as-left-
        // operand rule assumes every such right-hand property genuinely
        // exists (correct for confirming the *module* loaded, e.g. "typeof
        // OpCodes !== 'undefined' && OpCodes.SomeRealMethod"), which silently
        // collapsed this to "always true" even when OpCodes.js has never
        // actually defined that method - always false in the real JS
        // runtime too (the guard exists precisely so the code can fall
        // through to a different implementation when the optional helper
        // is absent). Verified against the real OpCodes module when
        // reachable (globalThis.OpCodes, set up by the transpiler host
        // before code generation runs - see measure_pl.js/the production
        // transpiler UI, both of which load OpCodes.js first); left
        // uncollapsed (returns false here, so _isFrameworkGuard's broader
        // "always true" rule still applies) when it can't be verified.
        // Left operand can be either the bare "OpCodes" identifier (see
        // above) or a "typeof OpCodes !== 'undefined'" guard - e.g.
        // special/shamir-secret-sharing.js's "typeof OpCodes !== 'undefined'
        // && OpCodes.SecureRandom" (OpCodes.js has never defined
        // SecureRandom either - see the real-module-verification comment
        // above; both spellings mean exactly the same "is the module loaded
        // AND does it define this optional method?" check).
        const leftIsBareOpCodes = test.left?.type === 'Identifier' && test.left.name === 'OpCodes';
        // "typeof OpCodes" may show up as a raw UnaryExpression or as the
        // shared IL AST's own 'TypeOfExpression' node (see the dual-shape
        // handling in the plain "typeof X !== 'undefined'" check above).
        const typeofOperand = test.left?.left;
        const isTypeofOpCodes = typeofOperand &&
          ((typeofOperand.type === 'UnaryExpression' && typeofOperand.operator === 'typeof' &&
            typeofOperand.argument?.name === 'OpCodes') ||
           ((typeofOperand.type === 'TypeOfExpression' || typeofOperand.ilNodeType === 'TypeOfExpression') &&
            (typeofOperand.value?.name || typeofOperand.argument?.name) === 'OpCodes'));
        const leftIsTypeofOpCodesGuard = test.left?.type === 'BinaryExpression' &&
          (test.left.operator === '!==' || test.left.operator === '!=') &&
          isTypeofOpCodes && test.left.right?.value === 'undefined';
        if ((leftIsBareOpCodes || leftIsTypeofOpCodesGuard) &&
            test.right?.type === 'MemberExpression' && !test.right.computed &&
            test.right.object?.type === 'Identifier' && test.right.object.name === 'OpCodes') {
          const propName = test.right.property?.name || test.right.property?.value;
          const realOpCodes = (typeof globalThis !== 'undefined') ? globalThis.OpCodes : undefined;
          if (realOpCodes && propName && typeof realOpCodes[propName] === 'undefined')
            return true;
        }
      }

      return false;
    }

    /**
     * Check if an IL AST node's body references 'this'
     */
    _bodyUsesThis(node) {
      if (!node || typeof node !== 'object') return false;
      if (node.type === 'ThisExpression' || node.ilNodeType === 'ThisExpression' ||
          node.type === 'ThisPropertyAccess' || node.ilNodeType === 'ThisPropertyAccess' ||
          node.type === 'ThisMethodCall' || node.ilNodeType === 'ThisMethodCall')
        return true;
      // Check for MemberExpression with this as object
      if (node.type === 'MemberExpression' && node.object?.type === 'ThisExpression')
        return true;
      // Recurse into child nodes (but not into nested function scopes)
      for (const key of Object.keys(node)) {
        if (key === 'type' || key === 'ilNodeType' || key === 'resultType') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          for (const item of child)
            if (item && typeof item === 'object' && this._bodyUsesThis(item)) return true;
        } else if (child && typeof child === 'object') {
          // Don't recurse into nested function expressions (they have their own 'this' scope)
          if (child.type === 'FunctionExpression' || child.type === 'ArrowFunctionExpression' ||
              child.type === 'ArrowFunction' || child.type === 'FunctionDeclaration') continue;
          if (this._bodyUsesThis(child)) return true;
        }
      }
      return false;
    }

    /**
     * Transform spread element: ...array
     */
    transformSpreadElement(node) {
      // In Perl, array flattening is automatic: @array
      // Mark the result as spread so the emitter knows to dereference it
      const result = this.transformExpression(node.argument);
      if (result) result.spread = true;
      return result;
    }

    /**
     * Transform template literal: `Hello ${name}!` -> "Hello $name!"
     */
    transformTemplateLiteral(node) {
      const parts = [];

      for (let i = 0; i < node.quasis.length; ++i) {
        const quasi = node.quasis[i].value.raw;
        if (quasi) {
          parts.push(quasi);
        }
        if (i < node.expressions.length) {
          parts.push(this.transformExpression(node.expressions[i]));
        }
      }

      return new PerlStringInterpolation(parts);
    }

    /**
     * Infer Perl sigil from variable name
     * Note: Be conservative - default to scalar unless clearly an array/hash
     * This avoids issues with singular words that happen to end in 's'
     * (like "positions", "bytes", "status", "class", "process", etc.)
     */
    inferSigilFromName(name) {
      // In JS-to-Perl transpilation, nearly all variables are scalars:
      // - JS arrays become array references ($arr = [...]) not Perl arrays (@arr)
      // - JS objects become hash references ($obj = {...}) not Perl hashes (%obj)
      // - Function parameters are always scalars
      // Name-based guessing (e.g., 'options' → %, 'Algorithms' → @) causes
      // more wrong-sigil errors than it prevents. Always default to $.
      return '$';
    }

    /**
     * Infer sigil from value expression
     * Note: JavaScript arrays are stored as array references in Perl ($arr = [...])
     * not as Perl arrays (@arr = (...)). This allows consistent access with $arr->[$i].
     */
    inferSigilFromValue(valueNode) {
      if (!valueNode) return '$';

      switch (valueNode.type) {
        case 'ObjectExpression':
          // Perl hashes as hash references
          return '$';
        case 'ArrayExpression':
        default:
          // Scalar for everything, including array references
          return '$';
      }
    }

    // ========================[ IL Node Type Transforms ]========================

    /**
     * Transform StringToBytes IL node (OpCodes.AnsiToBytes/Utf8ToBytes)
     * Converts a string to byte array
     */
    transformStringToBytes(node) {
      const arg = node.arguments && node.arguments[0];
      if (!arg) return new PerlArray([]);

      // If it's a literal string, we can convert directly
      if (arg.type === 'Literal' && typeof arg.value === 'string') {
        const str = arg.value;
        if (str === '') return new PerlArray([]);

        // For short strings, inline as byte array: [ord('a'), ord('b'), ...]
        if (str.length <= 16) {
          const bytes = [];
          for (let i = 0; i < str.length; ++i)
            bytes.push(new PerlCall('ord', [PerlLiteral.String(str.charAt(i), "'")]));
          return new PerlArray(bytes);
        }

        // For longer strings: [unpack 'C*', 'string']
        return new PerlArray([
          new PerlCall('unpack', [
            PerlLiteral.String('C*', "'"),
            PerlLiteral.String(str, "'")
          ])
        ]);
      }

      // Dynamic expression: [unpack 'C*', $expr]
      const expr = this.transformExpression(arg);
      return new PerlArray([
        new PerlCall('unpack', [PerlLiteral.String('C*', "'"), expr])
      ]);
    }

    /**
     * Transform BytesToString IL node (OpCodes.BytesToAnsi/BytesToUtf8)
     * Converts byte array to string
     */
    transformBytesToString(node) {
      const arg = node.arguments && node.arguments[0];
      if (!arg) return PerlLiteral.String('', "'");

      // pack('C*', @{$arr}) - converts array of bytes to string
      const expr = this.transformExpression(arg);
      return new PerlCall('pack', [
        PerlLiteral.String('C*', "'"),
        new PerlUnaryExpression('@', expr, true)
      ]);
    }

    /**
     * Transform HexDecode IL node (OpCodes.Hex8ToBytes)
     * Converts hex string to byte array
     */
    transformHexDecode(node) {
      const arg = node.arguments && node.arguments[0];
      if (!arg) return new PerlArray([]);

      // If it's a literal hex string, we can convert directly
      if (arg.type === 'Literal' && typeof arg.value === 'string') {
        const hex = arg.value;
        if (hex === '') return new PerlArray([]);

        // Use pack to decode hex: [unpack 'C*', pack 'H*', 'hexstring']
        return new PerlArray([
          new PerlCall('unpack', [
            PerlLiteral.String('C*', "'"),
            new PerlCall('pack', [
              PerlLiteral.String('H*', "'"),
              PerlLiteral.String(hex, "'")
            ])
          ])
        ]);
      }

      // Dynamic expression
      const expr = this.transformExpression(arg);
      return new PerlArray([
        new PerlCall('unpack', [
          PerlLiteral.String('C*', "'"),
          new PerlCall('pack', [PerlLiteral.String('H*', "'"), expr])
        ])
      ]);
    }

    /**
     * Transform PackBytes IL node (OpCodes.Pack16BE/LE, Pack32BE/LE, Pack64BE/LE)
     * Packs values into byte array
     */
    transformPackBytes(node) {
      const args = node.arguments || [];
      const bits = node.bits || 32;
      const isBig = node.endian === 'big';

      // Check for compile-time constant: PackBytes(SpreadElement(HexDecode("...")))
      if (args.length === 1 && args[0].type === 'SpreadElement') {
        const spreadArg = args[0].argument;
        if (spreadArg && (spreadArg.type === 'HexDecode' || spreadArg.ilNodeType === 'HexDecode')) {
          const hexArg = spreadArg.arguments?.[0];
          if (hexArg && hexArg.type === 'Literal' && typeof hexArg.value === 'string') {
            const hexStr = hexArg.value;
            const intValue = parseInt(hexStr, 16);
            if (!isNaN(intValue)) {
              // Return as hex literal for readability
              return PerlLiteral.Hex(intValue);
            }
          }
        }
      }

      // Transform arguments
      const transformedArgs = args.map(a => this.transformExpression(a));

      // Perl pack format codes:
      // 16-bit: n (big), v (little)
      // 32-bit: N (big), V (little)
      // 64-bit: Q> (big), Q< (little)
      let format;
      switch (bits) {
        case 16: format = isBig ? 'n' : 'v'; break;
        case 32: format = isBig ? 'N' : 'V'; break;
        case 64: format = isBig ? 'Q>' : 'Q<'; break;
        default: format = isBig ? 'N' : 'V'; break;
      }

      // Pack bytes into integer: unpack('N', pack('C4', @bytes))
      // This returns a scalar integer value
      return new PerlCall('unpack', [
        PerlLiteral.String(format, "'"),
        new PerlCall('pack', [PerlLiteral.String('C' + (bits / 8), "'"), ...transformedArgs])
      ]);
    }

    /**
     * Transform UnpackBytes IL node (OpCodes.Unpack16BE/LE, Unpack32BE/LE, Unpack64BE/LE)
     * Converts an integer to a byte array
     * e.g., OpCodes.Unpack32BE(0x12345678) -> [0x12, 0x34, 0x56, 0x78]
     */
    transformUnpackBytes(node) {
      const args = (node.arguments || []).map(a => this.transformExpression(a));
      const bits = node.bits || 32;
      const isBig = node.endian === 'big';
      const numBytes = bits / 8;

      let format;
      switch (bits) {
        case 16: format = isBig ? 'n' : 'v'; break;
        case 32: format = isBig ? 'N' : 'V'; break;
        case 64: format = isBig ? 'Q>' : 'Q<'; break;
        default: format = isBig ? 'N' : 'V'; break;
      }

      // Convert integer to bytes: [unpack('C4', pack('N', $int))]
      // This takes an integer and returns an array of bytes
      const intArg = args[0];
      const packCall = new PerlCall('pack', [
        PerlLiteral.String(format, "'"),
        intArg
      ]);

      return new PerlArray([
        new PerlCall('unpack', [
          PerlLiteral.String('C' + numBytes, "'"),
          packCall
        ])
      ]);
    }

    /**
     * Transform ArrayXor IL node (OpCodes.XorArrays)
     * XOR two byte arrays element-wise
     */
    transformArrayXor(node) {
      const args = (node.arguments || []).map(a => this.transformExpression(a));
      if (args.length < 2) return new PerlArray([]);

      const arr1 = args[0];
      const arr2 = args[1];

      // Mirrors OpCodes.XorArrays(arr1, arr2): XOR up to the shorter
      // array's length, masking each result to a byte. arr1/arr2 may be
      // arbitrary expressions (e.g. an inline slice like
      // cipherBlock.slice(0, n)), not just plain array variables, so
      // $#arr1 (last-index) isn't safe to take directly on them - and
      // using only arr1's length silently ignored a shorter arr2. Bind
      // both to locals once instead:
      // do { my $a = ARR1; my $b = ARR2;
      //      my $len = scalar(@$a) < scalar(@$b) ? scalar(@$a) : scalar(@$b);
      //      [map { ($a->[$_] ^ $b->[$_]) & 0xff } 0 .. $len - 1] }
      const aVar = new PerlIdentifier('_xor_a', '$');
      const bVar = new PerlIdentifier('_xor_b', '$');
      const lenVar = new PerlIdentifier('_xor_len', '$');

      const lenOf = v => new PerlCall('scalar', [new PerlUnaryExpression('@', v, true)]);

      const mapBody = new PerlBlock([
        new PerlExpressionStatement(
          new PerlBinaryExpression(
            new PerlGrouped(new PerlBinaryExpression(
              new PerlSubscript(aVar, new PerlIdentifier('_', '$'), 'array'),
              '^',
              new PerlSubscript(bVar, new PerlIdentifier('_', '$'), 'array')
            )),
            '&',
            PerlLiteral.Hex(0xFF)
          )
        )
      ]);

      return new PerlCall('do', [new PerlBlock([
        new PerlVarDeclaration('my', '_xor_a', '$', arr1),
        new PerlVarDeclaration('my', '_xor_b', '$', arr2),
        new PerlVarDeclaration('my', '_xor_len', '$',
          new PerlConditional(
            new PerlBinaryExpression(lenOf(aVar), '<', lenOf(bVar)),
            lenOf(aVar),
            lenOf(bVar)
          )
        ),
        new PerlExpressionStatement(new PerlArray([
          new PerlCall('map', [
            mapBody,
            new PerlBinaryExpression(PerlLiteral.Number(0), '..', new PerlBinaryExpression(lenVar, '-', PerlLiteral.Number(1)))
          ])
        ]))
      ])]);
    }

    /**
     * Transform ArrayClear IL node (OpCodes.ClearArray)
     * Clear/reset an array
     */
    transformArrayClear(node) {
      const arg = node.arguments && node.arguments[0];
      if (!arg) return new PerlIdentifier('undef');

      const arr = this.transformExpression(arg);
      // Wrap in do block so it's safe in expression context (e.g., $x && ClearArray)
      return new PerlRawCode(`do { @{${arr}} = () }`);
    }

    /**
     * Transform ArrayForEach IL node (array.forEach callback)
     */
    transformArrayForEach(node) {
      const arr = this.transformExpression(node.array);
      const callback = node.callback;

      // Get callback parameter names
      let paramName = 'x';
      let indexName = null;
      if (callback.params && callback.params.length > 0) {
        paramName = callback.params[0].name || 'x';
        if (callback.params.length > 1)
          indexName = callback.params[1].name;
      }

      this.registerVariableType(paramName, '$');

      // Transform callback body
      const bodyStmts = callback.body.type === 'BlockStatement'
        ? callback.body.body.map(s => this.transformStatement(s)).filter(s => s !== null)
        : [new PerlExpressionStatement(this.transformExpression(callback.body))];

      // If index parameter is used, generate a C-style for loop
      if (indexName) {
        this.registerVariableType(indexName, '$');
        const arrDeref = this.wrapArrayDeref(arr);

        // Build loop body: my $elem = $arr->[$idx]; <original body stmts>
        const loopBodyStatements = [
          new PerlVarDeclaration('my', paramName, '$',
            new PerlSubscript(arr, new PerlIdentifier(indexName, '$'), 'array')),
          ...bodyStmts
        ];

        const forInit = new PerlVarDeclaration('my', indexName, '$', PerlLiteral.Number(0));
        const forCond = new PerlBinaryExpression(
          new PerlIdentifier(indexName, '$'),
          '<',
          new PerlCall('scalar', [arrDeref])
        );
        const forIncr = new PerlUnaryExpression('++', new PerlIdentifier(indexName, '$'), false);

        const forLoop = new PerlFor();
        forLoop.isCStyle = true;
        forLoop.init = forInit;
        forLoop.condition = forCond;
        forLoop.increment = forIncr;
        forLoop.body = new PerlBlock(loopBodyStatements);
        return forLoop;
      }

      // Simple foreach loop (no index)
      return new PerlFor(
        '$' + paramName,
        new PerlUnaryExpression('@', arr, true),
        new PerlBlock(bodyStmts)
      );
    }

    /**
     * A JS "return X;" inside a .map()/.filter() callback body means "this
     * is the value produced for the current element" - transpiled 1:1 as a
     * literal Perl "return" statement, that's a real bug: a Perl map/grep
     * BLOCK isn't its own subroutine, it's evaluated in the context of
     * (shares a call stack frame with) whatever sub the map/grep call
     * itself appears in, so "return" inside it exits THAT enclosing sub
     * entirely - or, if the map/grep is at file scope (module-level data
     * table construction, e.g. block/khazad.js's/hierocrypt-l1.js's
     * "$tables = [map { ...; return {hi: ..., lo: ...}; } @$rawTables]"),
     * there's no enclosing sub to return from at all, dying "Can't return
     * outside a subroutine" at compile time. Recursively rewrites every
     * Return node reachable through nested If/Block statements (without
     * descending into a NESTED map/grep's own callback, which needs the
     * exact same treatment independently, or a real sub, which legitimately
     * needs its own "return") into a bare expression statement - Perl's
     * map/grep block already yields its last-evaluated expression as the
     * per-element result, exactly like the "return" was expressing.
     * @param {object} stmt - a PerlNode (or array of statements)
     * @returns {object}
     */
    _unwrapMapBlockReturns(stmt) {
      if (!stmt) return stmt;
      if (Array.isArray(stmt)) return stmt.map(s => this._unwrapMapBlockReturns(s));
      if (stmt.nodeType === 'Return')
        return new PerlExpressionStatement(stmt.expression || PerlLiteral.Undef());
      if (stmt.nodeType === 'Block' && stmt.statements) {
        stmt.statements = stmt.statements.map(s => this._unwrapMapBlockReturns(s));
        return stmt;
      }
      if (stmt.nodeType === 'If') {
        if (stmt.thenBranch) stmt.thenBranch = this._unwrapMapBlockReturns(stmt.thenBranch);
        if (stmt.elsifBranches) {
          stmt.elsifBranches = stmt.elsifBranches.map(b =>
            ({ condition: b.condition, body: this._unwrapMapBlockReturns(b.body) }));
        }
        if (stmt.elseBranch) stmt.elseBranch = this._unwrapMapBlockReturns(stmt.elseBranch);
        return stmt;
      }
      return stmt;
    }

    /**
     * Transform ArrayMap IL node (array.map callback)
     */
    transformArrayMap(node) {
      const arr = this.transformExpression(node.array);
      const arrDeref = this.wrapArrayDeref(arr);  // Use helper to avoid @keys() issue
      const callback = node.callback;

      // Handle callbacks that are identifiers (like Number, String, Boolean)
      if (callback.type === 'Identifier') {
        const builtinMapping = {
          'Number': '0 + $_',          // Numeric context
          'String': '"$_"',            // String interpolation
          'Boolean': '!!$_',           // Boolean context
          'parseInt': 'int($_)',       // Integer conversion
          'parseFloat': '0 + $_'       // Float conversion
        };
        const perlExpr = builtinMapping[callback.name];
        if (perlExpr) {
          const mapBody = new PerlBlock([
            new PerlExpressionStatement(new PerlIdentifier(perlExpr, ''))
          ]);
          return new PerlArray([
            new PerlCall('map', [mapBody, arrDeref])
          ]);
        }
        // Unknown function - call it with $_
        const mapBody = new PerlBlock([
          new PerlExpressionStatement(new PerlCall(this.toSnakeCase(callback.name), [new PerlIdentifier('_', '$')]))
        ]);
        return new PerlArray([
          new PerlCall('map', [mapBody, arrDeref])
        ]);
      }

      // Handle MemberExpression callbacks (like Math.floor)
      if (callback.type === 'MemberExpression' && !callback.body) {
        const funcExpr = this.transformExpression(callback);
        const mapBody = new PerlBlock([
          new PerlExpressionStatement(new PerlCall(funcExpr, [new PerlIdentifier('_', '$')]))
        ]);
        return new PerlArray([
          new PerlCall('map', [mapBody, arrDeref])
        ]);
      }

      // Get callback parameter names
      let paramName = '_';
      let indexName = null;
      if (callback.params && callback.params.length > 0) {
        paramName = callback.params[0].name || '_';
        if (callback.params.length > 1) {
          indexName = callback.params[1].name;
        }
      }

      // For map, we use Perl's map { } @arr
      // If param is $_, we can use implicit (unless we need an index)
      const useImplicit = paramName === '_' && !indexName;

      // If index is used, we need a different approach:
      // Use for loop with index counter instead of map
      if (indexName) {
        // Convert to: do { my @_result; for (my $idx = 0; $idx < scalar(@arr); $idx++) { my $elem = $arr->[$idx]; push @_result, <expr>; } \@_result }
        this.registerVariableType(paramName, '$');
        this.registerVariableType(indexName, '$');

        const resultVar = '_map_result_' + (this.mapCounter || 0);
        this.mapCounter = (this.mapCounter || 0) + 1;

        let bodyExpr;
        if (callback.body && callback.body.type === 'BlockStatement') {
          // Block body - transform all statements
          const bodyStmts = callback.body.body.map(s => this.transformStatement(s));
          bodyExpr = bodyStmts.length > 0 ? bodyStmts[bodyStmts.length - 1] : new PerlIdentifier('_', '$');
        } else if (callback.body) {
          bodyExpr = new PerlExpressionStatement(this.transformExpression(callback.body));
        } else {
          bodyExpr = new PerlExpressionStatement(new PerlIdentifier('_', '$'));
        }

        // Build loop body: my $elem = $arr->[$idx]; push @result, expr
        // Skip declaring $_ since it's a special variable in Perl
        const loopBodyStatements = [];
        if (paramName !== '_') {
          loopBodyStatements.push(
            new PerlVarDeclaration('my', paramName, '$',
              new PerlSubscript(arr, new PerlIdentifier(indexName, '$'), 'array'))
          );
        }
        loopBodyStatements.push(
          new PerlCall('push', [
            new PerlIdentifier(resultVar, '@'),
            bodyExpr.expression || bodyExpr
          ])
        );
        const loopBody = new PerlBlock(loopBodyStatements);

        // Build for loop: for (my $idx = 0; $idx < scalar(@arr); $idx++)
        const forInit = new PerlVarDeclaration('my', indexName, '$', PerlLiteral.Number(0));
        const forCond = new PerlBinaryExpression(
          new PerlIdentifier(indexName, '$'),
          '<',
          new PerlCall('scalar', [arrDeref])
        );
        const forIncr = new PerlUnaryExpression('++', new PerlIdentifier(indexName, '$'), false);

        const forLoop = new PerlFor();
        forLoop.isCStyle = true;
        forLoop.init = forInit;
        forLoop.condition = forCond;
        forLoop.increment = forIncr;
        forLoop.body = loopBody;

        // Wrap in do block: do { my @result; for ... ; \@result }
        return new PerlCall('do', [new PerlBlock([
          new PerlVarDeclaration('my', resultVar, '@', null),
          forLoop,
          new PerlUnaryExpression('\\', new PerlIdentifier(resultVar, '@'), true)
        ])]);
      }

      let mapBody;
      if (callback.body && callback.body.type === 'BlockStatement') {
        // Block body - need to evaluate all statements and return last
        const stmts = this._unwrapMapBlockReturns(callback.body.body.map(s => this.transformStatement(s)));
        if (!useImplicit) {
          // Alias $_ to named param: my $param = $_;
          this.registerVariableType(paramName, '$');
          stmts.unshift(new PerlVarDeclaration('my', paramName, '$', new PerlIdentifier('_', '$')));
        }
        mapBody = new PerlBlock(stmts);
      } else if (callback.body) {
        // Expression body
        if (!useImplicit) {
          // Need to alias: map { my $x = $_; expr } @arr
          this.registerVariableType(paramName, '$');
          mapBody = new PerlBlock([
            new PerlVarDeclaration('my', paramName, '$', new PerlIdentifier('_', '$')),
            new PerlExpressionStatement(this.transformExpression(callback.body))
          ]);
        } else {
          mapBody = new PerlBlock([
            new PerlExpressionStatement(this.transformExpression(callback.body))
          ]);
        }
      } else {
        // No body - return $_ unchanged
        mapBody = new PerlBlock([
          new PerlExpressionStatement(new PerlIdentifier('_', '$'))
        ]);
      }

      return new PerlArray([
        new PerlCall('map', [mapBody, arrDeref])
      ]);
    }

    /**
     * Transform ArrayFilter IL node (array.filter callback)
     */
    transformArrayFilter(node) {
      const arr = this.transformExpression(node.array);
      const arrDeref = this.wrapArrayDeref(arr);  // Use helper to avoid @keys() issue
      const callback = node.callback;

      // Handle callbacks that are identifiers (like Number, Boolean)
      if (callback.type === 'Identifier') {
        const builtinMapping = {
          'Number': '$_',              // Truthy check on numeric value
          'Boolean': '$_',             // Truthy check
          'String': '$_',              // Truthy check on string value
          'isFinite': 'defined($_) && $_ =~ /^-?\\d+(\\.\\d+)?$/',
          'isNaN': '!defined($_) || $_ !~ /^-?\\d+(\\.\\d+)?$/'
        };
        const perlExpr = builtinMapping[callback.name];
        if (perlExpr) {
          const grepBody = new PerlBlock([
            new PerlExpressionStatement(new PerlIdentifier(perlExpr, ''))
          ]);
          return new PerlArray([
            new PerlCall('grep', [grepBody, arrDeref])
          ]);
        }
        // Unknown function - call it with $_
        const grepBody = new PerlBlock([
          new PerlExpressionStatement(new PerlCall(this.toSnakeCase(callback.name), [new PerlIdentifier('_', '$')]))
        ]);
        return new PerlArray([
          new PerlCall('grep', [grepBody, arrDeref])
        ]);
      }

      // Handle MemberExpression callbacks (like Math.floor)
      if (callback.type === 'MemberExpression' && !callback.body) {
        const funcExpr = this.transformExpression(callback);
        const grepBody = new PerlBlock([
          new PerlExpressionStatement(new PerlCall(funcExpr, [new PerlIdentifier('_', '$')]))
        ]);
        return new PerlArray([
          new PerlCall('grep', [grepBody, arrDeref])
        ]);
      }

      // Get callback parameter names
      let paramName = '_';
      let indexName = null;
      let arrayName = null;
      if (callback.params && callback.params.length > 0) {
        paramName = callback.params[0].name || '_';
        if (callback.params.length > 1) {
          indexName = callback.params[1].name;
        }
        if (callback.params.length > 2) {
          arrayName = callback.params[2].name;
        }
      }

      // If index or array parameter is used, we need a for loop instead of grep
      if (indexName || arrayName) {
        this.registerVariableType(paramName, '$');
        this.registerVariableType(indexName, '$');
        // Array parameter is passed as a reference ($), not an array (@)
        if (arrayName) this.registerVariableType(arrayName, '$');

        const resultVar = '_filter_result_' + (this.filterCounter || 0);
        this.filterCounter = (this.filterCounter || 0) + 1;

        // Build the condition expression from callback body
        let conditionExpr;
        if (callback.body && callback.body.type === 'BlockStatement') {
          // Transform block - take the last expression as condition
          const transformed = callback.body.body.map(s => this.transformStatement(s));
          conditionExpr = transformed.length > 0 ? transformed[transformed.length - 1] : new PerlIdentifier('_', '$');
        } else if (callback.body) {
          conditionExpr = this.transformExpression(callback.body);
        } else {
          conditionExpr = new PerlIdentifier('_', '$');
        }

        // Build loop body statements
        const loopBodyStatements = [];

        // Declare element variable if not $_
        if (paramName !== '_') {
          loopBodyStatements.push(
            new PerlVarDeclaration('my', paramName, '$',
              new PerlSubscript(arr, new PerlIdentifier(indexName, '$'), 'array'))
          );
        }

        // Declare array variable if used (pass array reference)
        if (arrayName) {
          loopBodyStatements.push(
            new PerlVarDeclaration('my', arrayName, '$', arr)
          );
        }

        // Add conditional push - extract expression from conditionExpr
        const pushCondition = conditionExpr.expression || conditionExpr;
        const elementToPush = paramName !== '_'
          ? new PerlIdentifier(paramName, '$')
          : new PerlSubscript(arr, new PerlIdentifier(indexName, '$'), 'array');
        loopBodyStatements.push(
          new PerlIf(
            pushCondition,
            new PerlBlock([
              new PerlCall('push', [
                new PerlIdentifier(resultVar, '@'),
                elementToPush
              ])
            ])
          )
        );

        const loopBody = new PerlBlock(loopBodyStatements);

        // Create for loop: for (my $i = 0; $i < scalar(@arr); $i++)
        const forInit = new PerlVarDeclaration('my', indexName, '$', PerlLiteral.Number(0));
        const forCond = new PerlBinaryExpression(
          new PerlIdentifier(indexName, '$'),
          '<',
          new PerlCall('scalar', [arrDeref])
        );
        const forIncr = new PerlUnaryExpression('++', new PerlIdentifier(indexName, '$'), false);

        const forLoop = new PerlFor();
        forLoop.isCStyle = true;
        forLoop.init = forInit;
        forLoop.condition = forCond;
        forLoop.increment = forIncr;
        forLoop.body = loopBody;

        // Return: do { my @result; for (...) {...} \@result }
        return new PerlCall('do', [new PerlBlock([
          new PerlVarDeclaration('my', resultVar, '@', null),
          forLoop,
          new PerlUnaryExpression('\\', new PerlIdentifier(resultVar, '@'), true)
        ])]);
      }

      const useImplicit = paramName === '_';

      let grepBody;
      if (callback.body && callback.body.type === 'BlockStatement') {
        const stmts = this._unwrapMapBlockReturns(callback.body.body.map(s => this.transformStatement(s)));
        if (!useImplicit) {
          this.registerVariableType(paramName, '$');
          stmts.unshift(new PerlVarDeclaration('my', paramName, '$', new PerlIdentifier('_', '$')));
        }
        grepBody = new PerlBlock(stmts);
      } else if (callback.body) {
        if (!useImplicit) {
          this.registerVariableType(paramName, '$');
          grepBody = new PerlBlock([
            // Shadow the callback parameter with a local copy of $_
            new PerlVarDeclaration('my', paramName, '$', new PerlIdentifier('_', '$')),
            new PerlExpressionStatement(this.transformExpression(callback.body))
          ]);
        } else {
          grepBody = new PerlBlock([
            new PerlExpressionStatement(this.transformExpression(callback.body))
          ]);
        }
      } else {
        // No body - use $_ as truthy test
        grepBody = new PerlBlock([
          new PerlExpressionStatement(new PerlIdentifier('_', '$'))
        ]);
      }

      return new PerlArray([
        new PerlCall('grep', [grepBody, arrDeref])
      ]);
    }

    /**
     * Transform RotateLeft/RotateRight IL node
     * Bit rotation operations
     */
    transformRotation(node) {
      const rawValue = this.transformExpression(node.value);
      const amount = this.transformExpression(node.amount);
      const bits = node.bits || 32;
      const isLeft = node.type === 'RotateLeft';

      // Rotation formula:
      // Left:  ((val << n) | (val >> (bits - n))) & mask
      // Right: ((val >> n) | (val << (bits - n))) & mask
      const mask = bits === 64 ? '0xFFFFFFFFFFFFFFFF' :
                   bits === 32 ? '0xFFFFFFFF' :
                   bits === 16 ? '0xFFFF' :
                   bits === 8 ? '0xFF' : '0xFFFFFFFF';

      // Mask the value to `bits` width BEFORE rotating - mirrors
      // OpCodes.js's own RotL32/RotR32/... ("value = value >>> 0;" ahead of
      // the shift/or), which every OpCodes.RotL32(...) call site implicitly
      // relies on for width normalization. Many call sites pass an
      // unmasked multi-term addition chain straight in (the common MD/SHA/
      // RIPEMD round-function idiom "a = RotL32(a + f(b,c,d) + X[i] + K, s)"
      // - some algorithms pre-mask with OpCodes.ToUint32 first, many don't,
      // trusting the rotate itself to do it). JS's ">>> 0" truncation makes
      // that safe there; Perl's native (64-bit-on-any-modern-build)
      // integers don't silently wrap at `bits` width, so leaving a
      // wider-than-`bits` value unmasked let its high bits survive into the
      // right-shift term below and land inside the valid low-order output
      // range, corrupting the rotated result (e.g. RIPEMD-256's dual round
      // function, which never calls ToUint32 - see the "Not a HASH
      // reference"/vector-fail investigation this was found from).
      const value = new PerlGrouped(new PerlBinaryExpression(rawValue, '&', new PerlIdentifier(mask, '')));

      // Mask the rotation *amount* to [0, bits-1] too - not just the value
      // above. OpCodes.RotL32/RotR32(...) (see OpCodes.js) always does this
      // internally ("positions &= 31") before rotating, so plenty of call
      // sites pass a runtime amount that's never pre-masked by the caller,
      // trusting the rotate to do it - e.g. block/mars.js's key schedule,
      // "OpCodes.RotL32(this.Sbox[...], K[i - 1])" with K[i-1] an arbitrary
      // 32-bit word, not a small constant. Without masking here, an amount
      // at or beyond `bits` makes "bits - amount" go negative, and Perl's
      // native "<<"/">>" (unlike OpCodes.RotL32's JS ">>> 0"-truncated
      // arithmetic) has no defined behavior for a negative or oversized
      // shift count - it silently produced garbage/undef instead of the
      // correctly-wrapped-around rotation JS actually computes. A
      // compile-time amount already known to be a small literal in
      // [0, bits-1] (the overwhelmingly common case, e.g. "RotL32(x, 8)")
      // skips the mask - it would be a no-op anyway.
      const amountNeedsMask = !(node.amount && node.amount.type === 'Literal' &&
        typeof node.amount.value === 'number' && Number.isInteger(node.amount.value) &&
        node.amount.value >= 0 && node.amount.value < bits);
      const maskedAmount = amountNeedsMask
        ? new PerlBinaryExpression(new PerlGrouped(amount), '&', PerlLiteral.Number(bits - 1))
        : amount;

      const bitsMinusN = new PerlBinaryExpression(
        PerlLiteral.Number(bits),
        '-',
        maskedAmount
      );

      let shift1, shift2;
      if (isLeft) {
        shift1 = new PerlBinaryExpression(value, '<<', maskedAmount);
        shift2 = new PerlBinaryExpression(value, '>>', bitsMinusN);
      } else {
        shift1 = new PerlBinaryExpression(value, '>>', maskedAmount);
        shift2 = new PerlBinaryExpression(value, '<<', bitsMinusN);
      }

      const orExpr = new PerlBinaryExpression(shift1, '|', shift2);
      return new PerlBinaryExpression(
        new PerlGrouped(orExpr),
        '&',
        new PerlIdentifier(mask, '')
      );
    }

    /**
     * Register a variable's type (sigil)
     */
    registerVariableType(name, sigil) {
      this.variableTypes.set(name, sigil);
    }

    /**
     * Check if expression is in string context
     */
    isStringContext(left, right) {
      // Simple heuristic: if either operand is a string literal, treat as string
      if (left && left.type === 'Literal' && typeof left.value === 'string') return true;
      if (right && right.type === 'Literal' && typeof right.value === 'string') return true;

      // Check IL AST resultType for string types
      const stringTypes = ['string', 'String', 'char', 'Char'];
      if (left && left.resultType && stringTypes.includes(left.resultType)) return true;
      if (right && right.resultType && stringTypes.includes(right.resultType)) return true;

      // Check for string method calls that return strings
      const stringMethods = ['toUpperCase', 'toLowerCase', 'toString', 'trim', 'substr', 'substring',
                             'charAt', 'charCodeAt', 'slice', 'split', 'join', 'replace', 'concat'];
      if (right && right.type === 'CallExpression' && right.callee?.property) {
        const methodName = right.callee.property.name || right.callee.property.value;
        if (stringMethods.includes(methodName)) return true;
      }

      // Check for Identifier with known string variable names. Checked on
      // both sides (not just left) - e.g. classical/columnar.js's
      // transposition-column sort comparator "a.letter === b.letter"
      // (a/b are plain arrow-function params of unknown type, .letter a
      // single-JS-char string read off a locally-built { letter, ... }
      // object literal - untracked by the this.field-only
      // arrayFieldNames/hashFieldNames/stringFieldNames prescans) needed
      // 'letter' recognized on whichever side is inspected first; without
      // it this fell back to numeric "==", which - since neither operand
      // is ever a NUMBER string - is always false via a "isnt numeric"
      // warning coercion, so the sort's letter-inequality branch never
      // actually re-orders anything (a bare originalPos tie-break, i.e. no
      // real sort at all).
      const STRING_PROP_NAMES = ['data', 'text', 'message', 'str', 'string', 'name', 'value',
        'char', 'letter', 'symbol', 'label', 'key'];
      if (left && left.type === 'MemberExpression' && !left.computed &&
          STRING_PROP_NAMES.includes(left.property?.name || left.property?.value))
        return true;
      if (right && right.type === 'MemberExpression' && !right.computed &&
          STRING_PROP_NAMES.includes(right.property?.name || right.property?.value))
        return true;

      // Fall back to the more thorough structural isStringType() checks
      // (tracked local string variables, string-returning get-accessors,
      // ||/?? string-literal fallbacks, etc.) - this.isStringContext() only
      // covers the narrower literal/resultType/method-name cases above, so
      // e.g. "extendedKey = initialKey + normalizedInput" (both plain
      // Identifiers referring to tracked string locals) would otherwise be
      // misdetected as numeric addition instead of string concatenation.
      if (this.isStringType(left) || this.isStringType(right))
        return true;

      return false;
    }

    /**
     * If node is a "typeof X === 'string'" comparison (in any operator/
     * operand-order permutation: ===/==/!==/!=, typeof on either side),
     * returns the raw (untransformed) X argument AST node; otherwise null.
     * Recognizes both the parser's IL TypeOfExpression node (argument
     * carried as `.argument`) and a plain JS UnaryExpression("typeof")
     * that slipped through un-lowered.
     *
     * Also matches 'number'/'bigint'/'boolean' (every other JS *primitive*
     * typeof result besides 'string' - not 'object'/'function'/'undefined',
     * which mean something different and aren't a plain-scalar test) - e.g.
     * random/self-shrinking-generator.js's polynomial/seed setters: "typeof
     * polyValue === 'number' ? ... : typeof polyValue === 'bigint' ? ... :
     * throw". Perl has no separate number/bigint/boolean typeof vocabulary
     * (a plain number and a plain string are both just an unreferenced
     * scalar), so every one of these means exactly the same thing as the
     * 'string' case: "X is not a reference" - see this method's call site
     * comment for why the generic TypeOfExpression "ref($x) || 'SCALAR'"
     * lowering can never make '===' 'number' true. Missing this made the
     * self-shrinking-generator's "typeof polyValue === 'number'" branch
     * (and its 'bigint' elsif) both always false, silently falling to the
     * final "throw" - caught and swallowed by the test harness's
     * eval-wrapped property setter, leaving _polynomial at its constructor
     * default (0xB400n) instead of the test vector's real value, which
     * then corrupted the LFSR feedback into a monotonic right-shift that
     * decays to state 0 and never recovers (the reported "infinite loop":
     * Result()'s output-length while loop can then never make progress).
     */
    /**
     * If `node` is the "normalize argument to an exact BigInt" guard idiom
     * - "if (typeof X !== 'bigint') X = BigInt(X);" (any brace/no-brace
     * form, no else) - returns X's identifier name; otherwise null. Used
     * by transformIfStatement to special-case this SPECIFIC shape ahead of
     * the generic typeof-comparison handling (_matchTypeofStringLiteral,
     * which buckets 'bigint' together with 'string'/'number'/'boolean' as
     * "X is an unreferenced Perl scalar" - correct for those three, but
     * backwards for 'bigint': this codebase represents a genuinely-wide
     * JS BigInt as a *blessed* Math::BigInt object, a Perl reference, once
     * any exact-precision arithmetic has touched it). Mistranslating this
     * exact idiom the same way as the other three produced "if
     * (ref($base)) { $base = $base; }" for block/ff.js's
     * BigIntegerUtils.pow()/.mod() (each opening with this guard to accept
     * either a plain Number or an already-BigInt argument): a no-op when
     * $base is already blessed, and no promotion at all when it isn't - so
     * $base stayed an imprecise plain scalar straight into
     * "$base ** $exponent" (Perl's native, floating-point exponentiation
     * once the true result exceeds native integer range), corrupting FF1
     * for any radix/length combination whose radix**length is large.
     * Deliberately narrow (only this exact "if (guard) singleAssignment;"
     * shape, no else) rather than changing the general 'bigint' bucket
     * itself, which asymmetric/diffie-hellman.js's/dsa.js's/random/
     * self-shrinking-generator.js's OWN "typeof X === 'bigint'" branches
     * (a DIFFERENT shape - an elseif arm alongside 'number', never
     * actually reached by their test vectors either way) currently rely
     * on passing unchanged.
     * @param {object} node - raw (untransformed) IfStatement AST node
     * @returns {string|null}
     */
    _matchNormalizeToBigIntGuard(node) {
      if (node.alternate) return null;
      if (!(node.test && node.test.type === 'BinaryExpression' &&
        (node.test.operator === '!==' || node.test.operator === '!='))) return null;
      const isTypeofNode = (n) => n && (n.type === 'TypeOfExpression' || n.ilNodeType === 'TypeOfExpression' ||
        (n.type === 'UnaryExpression' && n.operator === 'typeof'));
      const argOf = (n) => n.argument || n.value;
      let typeofArg = null;
      if (isTypeofNode(node.test.left) && node.test.right && node.test.right.value === 'bigint') typeofArg = argOf(node.test.left);
      else if (isTypeofNode(node.test.right) && node.test.left && node.test.left.value === 'bigint') typeofArg = argOf(node.test.right);
      if (!typeofArg || typeofArg.type !== 'Identifier') return null;

      let stmt = node.consequent;
      if (stmt && (stmt.type === 'BlockStatement' || stmt.type === 'Block') && Array.isArray(stmt.body) && stmt.body.length === 1) stmt = stmt.body[0];
      if (!stmt || stmt.type !== 'ExpressionStatement') return null;
      const expr = stmt.expression;
      if (!expr || expr.type !== 'AssignmentExpression' || expr.operator !== '=') return null;
      if (!expr.left || expr.left.type !== 'Identifier' || expr.left.name !== typeofArg.name) return null;
      const rhs = expr.right;
      const sameVarArg = (n) => n && n.type === 'Identifier' && n.name === typeofArg.name;
      const isBigIntCallOfSameVar =
        (rhs.type === 'BigIntCast' && sameVarArg(rhs.argument || (rhs.arguments && rhs.arguments[0]))) ||
        (rhs.type === 'CallExpression' && rhs.callee && rhs.callee.type === 'Identifier' && rhs.callee.name === 'BigInt' &&
          rhs.arguments && rhs.arguments.length === 1 && sameVarArg(rhs.arguments[0]));
      if (!isBigIntCallOfSameVar) return null;
      return typeofArg.name;
    }

    _matchTypeofStringLiteral(node) {
      if (!['===', '==', '!==', '!='].includes(node.operator)) return null;
      const isTypeofNode = (n) => n && (n.type === 'TypeOfExpression' || n.ilNodeType === 'TypeOfExpression' ||
        (n.type === 'UnaryExpression' && n.operator === 'typeof'));
      const argOf = (n) => n.argument || n.value;
      const isScalarTypeofLiteral = (n) => n?.type === 'Literal' &&
        (n.value === 'string' || n.value === 'number' || n.value === 'bigint' || n.value === 'boolean');
      if (isTypeofNode(node.left) && isScalarTypeofLiteral(node.right))
        return argOf(node.left);
      if (isTypeofNode(node.right) && isScalarTypeofLiteral(node.left))
        return argOf(node.right);
      return null;
    }

    /**
     * If node is a "typeof X.method === 'function'" comparison (any
     * ===/==/!==/!= operator/operand-order permutation, typeof on either
     * side, receiver a non-computed MemberExpression), returns the raw
     * (untransformed) MemberExpression node ("X.method"); otherwise null.
     * Duck-typing an interface this way (e.g. "typeof cipher.Feed ===
     * 'function'" - see modes/ede.js's/eee.js's setBlockCipher validation)
     * falls outside plain TypeOfExpression's generic "ref($x) || 'SCALAR'"
     * lowering, which only distinguishes Perl's own reference *types*
     * (ARRAY/HASH/CODE/...), never JS's typeof vocabulary - "'ARRAY' eq
     * 'function'" is simply always false. Worse, the generic
     * MemberExpression-property fallback used to read a *method* name off
     * an object treats it as a *hash key* ("$cipher->{'Feed'}", always
     * undef for a blessed object whose "Feed" is a sub, not a hash
     * entry), so the whole condition was always true - "Invalid block
     * cipher instance"/"Block cipher not set" on every call, no matter
     * what was actually passed in. A blessed-object interface/method-
     * existence check is exactly what Perl's built-in $obj->can('method')
     * tests for.
     */
    _matchTypeofFunctionLiteral(node) {
      if (!['===', '==', '!==', '!='].includes(node.operator)) return null;
      const isTypeofNode = (n) => n && (n.type === 'TypeOfExpression' || n.ilNodeType === 'TypeOfExpression' ||
        (n.type === 'UnaryExpression' && n.operator === 'typeof'));
      const argOf = (n) => n.argument || n.value;
      const isMethodMember = (n) => n && n.type === 'MemberExpression' && !n.computed;
      if (isTypeofNode(node.left) && isMethodMember(argOf(node.left)) &&
          node.right?.type === 'Literal' && node.right.value === 'function')
        return argOf(node.left);
      if (isTypeofNode(node.right) && isMethodMember(argOf(node.right)) &&
          node.left?.type === 'Literal' && node.left.value === 'function')
        return argOf(node.right);
      return null;
    }

    /**
     * Walk down through a chain of computed member accesses (e.g.
     * "matrix[row][col]" -> MemberExpression(computed) whose object is
     * itself MemberExpression(computed) whose object is Identifier
     * "matrix") to find the innermost base name - either a plain
     * Identifier's name or a "this.foo[...]" property name. Returns null
     * for anything else (computed base, call expression, etc).
     */
    _innermostMemberBaseName(node) {
      let cur = node;
      while (cur && cur.type === 'MemberExpression' && cur.computed) cur = cur.object;
      if (!cur) return null;
      if (cur.type === 'Identifier') return cur.name;
      if (cur.type === 'ThisPropertyAccess') return cur.property;
      if (cur.type === 'MemberExpression' && !cur.computed)
        return cur.property?.name || cur.property?.value || null;
      return null;
    }

    /**
     * Check if a node represents a string type
     * Uses resultType when available, falls back to conservative heuristics
     */
    isStringType(node) {
      if (!node) return false;

      // Check IL AST resultType - this is the most reliable indicator
      if (node.resultType === 'string' || node.resultType === 'String')
        return true;

      // Check for string literals
      if (node.type === 'Literal' && typeof node.value === 'string')
        return true;

      // Check IL StringSubstring node
      if (node.type === 'StringSubstring' || node.ilNodeType === 'StringSubstring')
        return true;

      // toString() call the IL misclassified as a DataViewRead node (see
      // transformExpression's 'DataViewRead' case comment) - always yields
      // a string (Number.prototype.toString([radix]) et al. never return
      // anything else), so e.g. "range.toString(2).length" (a bit-length
      // computation - see asymmetric/rabin.js's/rabin-williams.js's
      // _randomBigInt) needs this to route the ArrayLength node's
      // isStringType(node.array) check into Perl's length($str) rather
      // than the array-length scalar(@{$str}) default, which died "Can't
      // use string ... as an ARRAY ref" since $str is a plain string, not
      // a reference at all.
      if ((node.type === 'DataViewRead' || node.ilNodeType === 'DataViewRead') && node.method === 'toString')
        return true;

      // Check for string method calls that return strings
      // Only check method results when the type is not otherwise known
      // ("toString" included - Number/Array/Object.prototype.toString([radix])
      // always yields a string, regardless of receiver type or args - see
      // asymmetric/rabin.js's/rabin-williams.js's "range.toString(2).length"
      // bit-length idiom, whose IL node here is a plain untyped
      // CallExpression rather than the 'DataViewRead' node the comment on
      // this function's other toString check above targets; without this,
      // ArrayLength's isStringType(node.array) check missed it and fell
      // back to the array-length scalar(@{$str}) default, which died
      // "Can't use string ... as an ARRAY ref" since $str is a plain
      // string, not a reference).
      const stringMethods = ['substring', 'substr', 'toUpperCase', 'toLowerCase',
                             'trim', 'trimStart', 'trimEnd', 'charAt', 'concat', 'repeat',
                             'replace', 'replaceAll', 'padStart', 'padEnd', 'toString'];
      if (node.type === 'CallExpression' && node.callee?.property) {
        const methodName = node.callee.property.name || node.callee.property.value;
        if (stringMethods.includes(methodName)) return true;
      }

      // Computed member access into a known string (str[i]) yields a
      // single-character string in JS, same as str.charAt(i) - the IL's
      // generic computed-MemberExpression case only fills in resultType for
      // array element types, so this has to be detected structurally here.
      if (node.type === 'MemberExpression' && node.computed && this.isStringType(node.object))
        return true;

      // Name-based heuristic for classical-cipher letter grids: "matrix[row]
      // [col]"/"grid[r][c]"/"square[r][c]" hold individual (string)
      // characters built from a key+alphabet, in every Playfair/Foursquare/
      // Twosquare/Bifid/Trifid-style algorithm in this repo - but nothing
      // upstream of here can prove that structurally (the array is built
      // dynamically, one char at a time, often through a helper method
      // called from a different method than the one indexing it, several
      // hops beyond what the call-site parameter inference above tracks).
      // Without this, "matrix[row][col] === char" and "matrix[p1.row][p1.
      // col] + matrix[p2.row][p2.col]" silently defaulted to numeric "=="/
      // "+", which for non-numeric letters is *always* false / always 0
      // instead of raising an error - producing empty/garbage ciphertext
      // rather than a loud failure. Deliberately scoped to this narrow,
      // repo-wide-consistent naming convention rather than guessing at
      // every unresolvable computed member access (which would also
      // misfire on genuinely-numeric lookup tables like sbox/rcon).
      // Requires *two* levels of computed indexing (matrix[row][col], not
      // just matrix[row]) - a single level into one of these grids is still
      // a row, i.e. an array ref, not a character; only fully indexing both
      // dimensions reaches an actual (string) grid cell.
      if (node.type === 'MemberExpression' && node.computed &&
          node.object && node.object.type === 'MemberExpression' && node.object.computed &&
          // A positively-known numeric resultType on the inner "matrix[row]"
          // node (the type-aware parser DOES propagate an array element's
          // numeric resultType one level deep, even though it can't yet for
          // the outer two-level index, which is why this checks .object
          // rather than the node itself) overrides the name-based guess
          // below - e.g. ecc/cortex-code.js's/multi-edge-ldpc.js's sparse
          // binary connectivity matrix "matrix[row][col]" (0/1 ints, named
          // "matrix" purely by naming convention - a sparse adjacency
          // matrix, not a Playfair-style letter grid). Without this,
          // "connections += matrix[row][col];" (a plain numeric accumulate)
          // silently became Perl's ".=" (string-concat-assign) purely
          // because of the coincidental variable name: $connections
          // (initialized 0) accumulated a STRING of concatenated "0"/"1"
          // digits instead of their sum, which then numified (in the loop's
          // "< minRowConnections" comparison) to the string's leading
          // decimal digits - almost always far outside the real 0-3 range,
          // so the "ensure minimum row connections" fixup loop silently
          // never fired when it should have, corrupting the sparse
          // connectivity matrix (and every encoded codeword bit downstream
          // of it) in a way with no error message at all.
          !new Set(['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32', 'number', 'bigint'])
            .has(node.object.resultType)) {
        const baseName = this._innermostMemberBaseName(node);
        if (baseName && /^(matrix|grid|square)\d*$/i.test(baseName))
          return true;
        // "cube" (classical/trifid.js's 3x3x3 letter cube) is a 3-level
        // "cube[layer][row][col]" grid, one level deeper than matrix/grid/
        // square's 2-level "[row][col]" - reusing the same 2-level check
        // for it wrongly matched the *intermediate* "cube[layer][row]"
        // node too (whenever it's itself the ".object" of a further,
        // 3rd-level index - i.e. exactly when transformMemberExpression
        // calls isStringType(node.object) while transforming the OUTER
        // "cube[layer][row][col]" access): "cube[layer][row]" is still a
        // whole row (an array of 3 characters), not a character, so
        // wrongly reporting it as string-typed made
        // "cube[layer][row][col] = someChar" get treated as a substr()
        // pseudo-lvalue instead of plain array-element assignment - dying
        // "Can't modify do block in list assignment" for
        // createStandardCube's cube-building loop (see the out-of-range
        // "str[i]" fix's doc comment above transformMemberExpression's
        // computed-member-access case, which is what made this stop being
        // a silent no-op and start being a hard compile error). Requiring
        // one more level of computed indexing (checking
        // node.object.object too) restricts the "cube" match to genuine
        // 3-deep character-cell accesses only.
        if (baseName && /^cube\d*$/i.test(baseName) &&
            node.object.object && node.object.object.type === 'MemberExpression' && node.object.object.computed)
          return true;
      }

      // Single-level computed index into a field the this.
      // arrayOfStringFieldNames whole-file pre-scan flagged as holding an
      // array of *strings* (as opposed to arrays of arrays/objects) -
      // e.g. classical/enigma.js's "this.rotorWirings[rotorIndex]" (one
      // rotor's whole 26-letter wiring sequence) or classical/
      // jefferson-wheel.js's per-wheel sequences. Unlike the
      // matrix/grid/square heuristic just above (which needs *two* levels
      // of indexing to reach a single character, since one level there is
      // still a row/array), one level here already reaches the string -
      // a *further* index on top of this (e.g. "...[rotorIndex]
      // [adjustedInput]") is what needs to resolve through THIS check
      // (called on its "node.object") to route into substr() instead of
      // the array-of-arrays default. See _collectArrayOfStringFieldNames's
      // doc comment.
      if (node.type === 'MemberExpression' && node.computed) {
        const baseName = this._innermostMemberBaseName(node);
        if (baseName && this.arrayOfStringFieldNames && this.arrayOfStringFieldNames.has(baseName))
          return true;
      }

      // Identifier that was assigned a structurally-string initializer
      // earlier in this scope (see transformLetStatement) - e.g.
      // "const normalizedInput = str.toUpperCase().replace(...)" followed
      // by "for (const c of normalizedInput)" or "normalizedInput[i]".
      if (node.type === 'Identifier' && this.stringVariables && this.stringVariables.has(node.name))
        return true;

      // this.propName where propName is backed by a get-accessor whose
      // return value was pre-scanned as structurally a string (see
      // transformClassDeclaration's stringGetterNames pre-scan) - e.g.
      // "get key() { return this._processedKey || 'A'; }" makes
      // "this.key" (and anything assigned from it) recognized as a string.
      if (node.type === 'ThisPropertyAccess' && node.property && this.currentClassName) {
        const getters = this.classStringGetters.get(this.currentClassName);
        if (getters && getters.has(node.property))
          return true;
      }

      // Same lookup, but for an actual method *call* rather than a bare
      // property read - "this.normalizeText(text)" where normalizeText's
      // body was pre-scanned (see the non-getter-method loop feeding
      // classStringGetters above) as always structurally returning a string.
      if (this.currentClassName) {
        let methodName = null;
        if (node.type === 'ThisMethodCall' && node.method) methodName = node.method;
        else if (node.type === 'CallExpression' && node.callee?.type === 'MemberExpression' &&
                 node.callee.object?.type === 'ThisExpression')
          methodName = node.callee.property?.name || node.callee.property?.value;
        if (methodName) {
          const getters = this.classStringGetters.get(this.currentClassName);
          if (getters && getters.has(methodName)) return true;
        }
      }

      // Field name seen assigned a string literal somewhere in the file
      // (see _collectStringFieldNames/this.stringFieldNames) - unlike the
      // getter check just above, this isn't limited to the current class or
      // to direct "this.X" access, so it also catches a cross-object chain
      // like "someObj.algorithm.ALPHABET" (classical-cipher constant tables
      // read through an aliased "this.algorithm = algorithm" reference).
      if (this.stringFieldNames && this.stringFieldNames.size) {
        if (node.type === 'ThisPropertyAccess' && node.property && this.stringFieldNames.has(node.property))
          return true;
        if (node.type === 'MemberExpression' && !node.computed) {
          const propName = node.property?.name || node.property?.value;
          if (propName && this.stringFieldNames.has(propName)) return true;
        }
      }

      // String concatenation via "+": "a + b" is a string if either operand
      // structurally is (e.g. "extendedKey = initialKey + normalizedInput"),
      // matching the '+' -> '.' operator rewrite in transformBinaryExpression.
      if (node.type === 'BinaryExpression' && node.operator === '+') {
        if (this.isStringType(node.left) || this.isStringType(node.right))
          return true;
      }

      // Fallback-default pattern: "value || 'literal'" / "value ?? 'literal'"
      // takes on the string-ness of either side (used pervasively for
      // "this._processedKey || 'A'"-style getters) - if either operand is
      // structurally a string, treat the whole expression as a string.
      if (node.type === 'LogicalExpression' && (node.operator === '||' || node.operator === '??')) {
        if (this.isStringType(node.left) || this.isStringType(node.right))
          return true;
      }

      // Ternary "cond ? a : b" takes on the string-ness of its branches -
      // e.g. "this.isInverse ? this.decryptText(x) : this.encryptText(x)"
      // (common encrypt/decrypt-dispatch pattern) is a string whenever
      // *either* branch structurally is (both branches of a real algorithm
      // return the same conceptual type, so checking either is enough and
      // avoids needing both to independently prove out). Without this, a
      // local assigned from such a ternary fell through to array/hash
      // defaults for later ".length"/"[i]"/"Array.from(...)" uses on it.
      if (node.type === 'ConditionalExpression') {
        if (this.isStringType(node.consequent) || this.isStringType(node.alternate))
          return true;
      }

      // Note: We intentionally do NOT use variable name heuristics here
      // because they are too unreliable. Variables like 'data', 'result', etc.
      // are commonly used for both strings and arrays in crypto algorithms.
      // Only use explicit resultType from IL analysis.

      return false;
    }

    /**
     * True when `node` is positively known (via the same whole-file
     * arrayFieldNames/_localArrayVarNames prescan isArrayContext() uses) to
     * be array/typed-array-shaped - i.e. a "this.field = new Array(...)/[]/
     * new Uint8Array(...)" field, or a local "const x = new Uint8Array(...)"
     * variable. Deliberately conservative (false for anything not
     * positively confirmed, including plain unknown identifiers/fields and
     * class-instance fields) - used to gate the TypedArrayCreation ".buffer"
     * accessor unwrap (see its call site's doc comment) where treating an
     * ordinary non-array field as if it were a typed array's backing buffer
     * is the wrong direction to fail in.
     * @param {object} node
     * @returns {boolean}
     */
    _isConfirmedArrayShapedBase(node) {
      if (!node) return false;
      if (node.type === 'ThisPropertyAccess') {
        const p = node.property;
        return !!(p && this.arrayFieldNames && this.arrayFieldNames.has(p) &&
          !(this.hashFieldNames && this.hashFieldNames.has(p)));
      }
      if (node.type === 'MemberExpression' && !node.computed && node.object?.type === 'ThisExpression') {
        const p = node.property?.name || node.property?.value;
        return !!(p && this.arrayFieldNames && this.arrayFieldNames.has(p) &&
          !(this.hashFieldNames && this.hashFieldNames.has(p)));
      }
      if (node.type === 'Identifier') {
        return !!(this._localArrayVarNames && this._localArrayVarNames.has(node.name) &&
          !(this._localHashVarNames && this._localHashVarNames.has(node.name)));
      }
      return false;
    }

    /**
     * Check if subscript should be array-style (numeric index) vs hash-style (string key)
     * @param {Object} objectNode - The object being indexed
     * @param {Object} propertyNode - The index/key being used
     */
    isArrayContext(objectNode, propertyNode = null) {
      // A two-level "X[a][b]" access where X's elements are known (see
      // _collectArrayOfHashVarNames' doc comment) to themselves be plain
      // hash-maps ("X[a] = {};" somewhere in the file) - the OUTER index
      // (b, i.e. objectNode/propertyNode here is the *inner* "X[a]"/"b"
      // pair) is a hash key into that per-slot hash, never a further array
      // index, regardless of what b's own name looks like. Checked before
      // the name-based loop-index heuristics further down (a single-letter
      // loop variable like "c" would otherwise match those and wrongly
      // force array access even though the object being indexed is
      // positively known to be a hashref at this point).
      if (objectNode && objectNode.type === 'MemberExpression' && objectNode.computed &&
          objectNode.object && objectNode.object.type === 'Identifier' &&
          this._arrayOfHashVarNames && this._arrayOfHashVarNames.has(objectNode.object.name))
        return false;

      // Declared-shape overrides, checked first (highest confidence): all
      // of the heuristics below this point are guessing the container's
      // shape from what the *key* looks like (numeric literal, loop-index-
      // like name, ...) - but a container's actual declared/established
      // shape is stronger evidence and should win even when the key looks
      // numeric/loop-like, e.g. a round-indexed state dict ("const X = {};
      // X[1] = ...; X[round] = ...;", or "this.coordsToLetter = {};
      // this.coordsToLetter[coords] = ...;") is still a hash no matter how
      // numeric its keys are.
      //
      // A local variable initialized directly from an object literal.
      if (objectNode.type === 'Identifier' && this._localHashVarNames && this._localHashVarNames.has(objectNode.name) &&
          !(this._localArrayVarNames && this._localArrayVarNames.has(objectNode.name)))
        return false;

      // A "this.field = {}"-initialized class field (see
      // _collectArrayFieldNames' hashOut collection).
      const declaredFieldName = objectNode.type === 'ThisPropertyAccess' ? objectNode.property :
        (objectNode.type === 'MemberExpression' && !objectNode.computed && objectNode.object?.type === 'ThisExpression'
          ? (objectNode.property?.name || objectNode.property?.value) : null);
      if (declaredFieldName) {
        if (this.hashFieldNames && this.hashFieldNames.has(declaredFieldName) &&
            !(this.arrayFieldNames && this.arrayFieldNames.has(declaredFieldName)))
          return false;
        if (this.arrayFieldNames && this.arrayFieldNames.has(declaredFieldName) &&
            !(this.hashFieldNames && this.hashFieldNames.has(declaredFieldName)))
          return true;
      }

      // Same field-name lookup, generalized to "obj.field[computed]" where
      // obj is some *other* (non-this) local variable/expression holding a
      // class instance or plain-object-literal record - e.g.
      // "source.estimate[current]" where "estimate" was established
      // array-shaped elsewhere via "this.estimate = [...]"/an object-
      // literal property (both flat whole-file scans, not scoped to any
      // particular receiver - see _collectArrayFieldNames/
      // _collectObjectLiteralPropertyShapes).
      if (objectNode.type === 'MemberExpression' && !objectNode.computed) {
        const propName = objectNode.property?.name || objectNode.property?.value;
        if (propName) {
          if (this.arrayFieldNames && this.arrayFieldNames.has(propName) &&
              !(this.hashFieldNames && this.hashFieldNames.has(propName)))
            return true;
          if (this.hashFieldNames && this.hashFieldNames.has(propName) &&
              !(this.arrayFieldNames && this.arrayFieldNames.has(propName)))
            return false;
        }
      }

      // If we have a property node, check if it's numeric (array) vs string (hash)
      if (propertyNode) {
        // A key that is itself known to be a string (e.g. table[alphabet[i]],
        // where alphabet[i] is a single-character substr()) is unambiguously
        // a hash key, regardless of what identifier names happen to appear
        // inside it - check this before the name-based heuristics below,
        // since e.g. "alphabet[i]" would otherwise match the "property name
        // looks like a loop index" heuristic on its *inner* "i", even though
        // the whole expression's value is a character, not a number.
        if (this.isStringType(propertyNode))
          return false;

        // Check IL AST resultType - numeric types indicate array access
        if (propertyNode.resultType) {
          const numericTypes = ['int8', 'int16', 'int32', 'int64', 'uint8', 'uint16', 'uint32', 'uint64',
                                'float32', 'float64', 'number', 'int', 'uint', 'byte', 'short', 'long'];
          if (numericTypes.includes(propertyNode.resultType))
            return true;
        }

        // Numeric literals -> array access
        if (propertyNode.type === 'Literal' && typeof propertyNode.value === 'number')
          return true;

        // Variables that look like loop indices -> likely array access
        if (propertyNode.type === 'Identifier') {
          const name = propertyNode.name;
          // Common loop/index variable patterns (i, j, k, n, m, t, x, y, p, q, r, e) and numbered variants (i0, i1, etc.),
          // plus full descriptive index-variable words (kept in sync with the
          // ThisPropertyAccess-property variant below - "round"-keyed round-key
          // arrays, e.g. "this._roundKeys[round]", are the common miss without
          // this: "round" doesn't match any single-letter loop-variable pattern).
          //
          // Also a/b/c/d (with the same optional numbered-variant suffix) -
          // generic byte/word operand names in bitwise round-function helpers
          // (e.g. block/hierocrypt-l1.js's "_xsBox(b0, b1, round) { b0 =
          // this._sbox[b0]; b1 = this._sbox[b1]; ... }" S-box substitution).
          // Missing these previously misjudged "this._sbox[b0]" as a HASH
          // subscript ($self->{'_sbox'}->{$b0}) instead of an array lookup
          // ($self->{'_sbox'}->[$b0]) - _sbox holds a plain lookup array
          // (built by a helper method, not a literal this._sbox = {...}/[...]
          // the whole-file array/hash-field-name prescan could pick up), so
          // every substitution died "Not a HASH reference".
          // camelCase "...Idx" suffix (prevIdx, byteIdx, sourceIdx,
          // checkIdx, tblIdx, ...) is an extremely common index-variable
          // naming shorthand throughout this codebase (dozens of distinct
          // names, hundreds of occurrences) that the "Index$"/"^idx"
          // patterns above don't cover - "sourceIdx" ends in "Idx", not
          // "Index", and doesn't start with "idx" either. Missing this
          // misjudged e.g. "symbols[sourceIdx]" as a HASH subscript
          // ($symbols->{$sourceIdx}) instead of an array lookup
          // ($symbols->[$sourceIdx]), dying "Not a HASH reference".
          if (/^[abcdijknmtxypqre]\d*$/.test(name) || /Index$/.test(name) || /^idx/.test(name) ||
              /Idx$/.test(name) ||
              /^(row|col|column)\d*$/i.test(name) ||
              /^(position|index|idx|pos|offset|cursor|ptr|counter|round|cnt)$/i.test(name))
            return true;
        }

        // MemberExpression accessing index-like properties (e.g., this.i,
        // this.j, or - the common { row, col } grid-position object this
        // whole findPosition()-family idiom returns, e.g. "square2[pos1.
        // row][pos2.col]" - pos1.row/pos2.col) -> array access.
        if (propertyNode.type === 'MemberExpression' && propertyNode.property) {
          const propName = propertyNode.property.name || propertyNode.property.value;
          if (propName && (/^[ijknm]$/.test(propName) || /^(row|col|column)\d*$/i.test(propName)))
            return true;
        }

        // IL node types that represent numeric indices
        if (propertyNode.type === 'ThisPropertyAccess') {
          const propName = propertyNode.property;
          if (propName && (/^[ijknm]$/.test(propName) || /Idx$/.test(propName) ||
              /^(position|index|idx|pos|offset|cursor|ptr|counter|round|cnt|row|col|column)$/i.test(propName)))
            return true;
        }

        // Binary expressions with numeric operations -> array access
        // e.g., this.digits[this.digits.length - 1 - i]
        if (propertyNode.type === 'BinaryExpression') {
          const op = propertyNode.operator;
          // Arithmetic operators indicate numeric index
          if (['+', '-', '*', '/', '%', '<<', '>>', '>>>', '&', '|', '^'].includes(op))
            return true;
        }

        // Unary expressions on numeric values -> array access
        // e.g., arr[~i] or arr[-1]
        if (propertyNode.type === 'UnaryExpression') {
          const op = propertyNode.operator;
          if (['-', '+', '~'].includes(op))
            return true;
        }

        // Computed MemberExpression as index -> array access
        // e.g., F0[xx[i1]] where xx[i1] returns a numeric index
        if (propertyNode.type === 'MemberExpression' && propertyNode.computed)
          return true;

        // Call expression as index -> almost always a numeric byte/index
        // helper in this codebase (e.g. mix[i][getByte(word, i)]), not a
        // string key computation. Name patterns like getByte/byteAt/extract*
        // are the common case, but default to array here too since a call
        // result used as a computed subscript is overwhelmingly numeric in
        // crypto table-lookup code (S-boxes, mix tables, permutation tables).
        if (propertyNode.type === 'CallExpression')
          return true;

        // String literals -> hash access
        if (propertyNode.type === 'Literal' && typeof propertyNode.value === 'string')
          return false;
      }

      // Nested computed MemberExpression as the object (e.g. mix[i][x]) -
      // if the inner access mix[i] is itself array-shaped, the outer access
      // almost certainly is too (arrays of arrays: multi-dimensional S-box
      // / mix-table lookups are common in block ciphers).
      if (objectNode.type === 'MemberExpression' && objectNode.computed) {
        if (this.isArrayContext(objectNode.object, objectNode.property))
          return true;
      }

      // Check variable type registration
      if (objectNode.type === 'Identifier') {
        const sigil = this.variableTypes.get(objectNode.name);
        if (sigil === '@') return true;

        // Check if variable name suggests it's an array
        const name = objectNode.name.toLowerCase();
        if (/^(data|bytes|buffer|array|list|items|elements|bits|digits|input|output|result|block|state|key|iv|nonce|xx|yy|zz|ww|tt|ss|aa|bb|cc|dd|ee|ff|gg|hh|words|v|w|temp|tmp|out)$/.test(name))
          return true;
        // S-box and lookup table names (common in crypto algorithms)
        if (/^(sbox|s[0-9]*|f[0-9]*|p[0-9]*|k[0-9]*|t[0-9]*|l[0-9]*|r[0-9]*|delta|sigma|rcon|round|sub|inv)$/i.test(objectNode.name))
          return true;
        // Classical-cipher letter grids (Playfair/Foursquare/Twosquare/
        // Bifid/Trifid-style "matrix[row][col]") - see isStringType's
        // matching matrix/grid/square heuristic for why these hold string
        // elements, not numbers; they're still *array-of-array* refs
        // structurally, so single-level indexing here is array access too.
        if (/^(matrix|grid|square)\d*$/i.test(objectNode.name))
          return true;
      }

      // Same name-based heuristic, but for this.propName[...] (the IL
      // form of a this.X property access) - e.g. this.state[this.position]
      // is exactly as array-shaped as a local "state" variable would be,
      // but objectNode here is a ThisPropertyAccess, not an Identifier.
      if (objectNode.type === 'ThisPropertyAccess' && objectNode.property) {
        if (this.arrayFieldNames && this.arrayFieldNames.has(objectNode.property))
          return true;
        const name = objectNode.property.toLowerCase();
        if (/^(data|bytes|buffer|array|list|items|elements|bits|digits|input|output|result|block|state|key|iv|nonce|xx|yy|zz|ww|tt|ss|aa|bb|cc|dd|ee|ff|gg|hh|words|v|w|temp|tmp|out|inputbuffer|outputbuffer)$/.test(name))
          return true;
        if (/^(sbox|s[0-9]*|f[0-9]*|p[0-9]*|k[0-9]*|t[0-9]*|l[0-9]*|r[0-9]*|delta|sigma|rcon|round|sub|inv)$/i.test(objectNode.property))
          return true;
        if (/^(matrix|grid|square)\d*$/i.test(objectNode.property))
          return true;
      }

      // Same array-field-name lookup, for a plain local/loop variable that
      // was assigned "= new Array(...)" / "= []" somewhere in this file.
      if (objectNode.type === 'Identifier' && this.arrayFieldNames && this.arrayFieldNames.has(objectNode.name))
        return true;

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
  }

  // Export
  const exports = { PerlTransformer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.PerlTransformer = PerlTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
