/**
 * RustTransformer.js - IL AST to Rust AST Transformer
 * Converts IL AST (type-inferred, language-agnostic) to Rust AST
 * (c)2006-2025 Hawkynt
 *
 * Full Pipeline:
 *   JS Source → Parser → JS AST → IL Transformer → IL AST → Language Transformer → Language AST → Language Emitter → Language Source
 *
 * This transformer handles: IL AST → Rust AST
 *
 * IL AST characteristics:
 *   - Type-inferred (no untyped nodes)
 *   - Language-agnostic (no JS-specific constructs like UMD, IIFE, Math.*, Object.*, etc.)
 *   - Global options already applied
 *
 * Language options (applied here and in emitter):
 *   - edition: Rust edition (2015, 2018, 2021)
 *   - noStd: Enable no_std mode
 *   - useZeroCopy: Use zero-copy patterns
 *   - addComments: Include generated comments
 */

(function(global) {
  'use strict';

  // Load dependencies
  let RustAST;
  if (typeof require !== 'undefined') {
    RustAST = require('./RustAST.js');
  } else if (global.RustAST) {
    RustAST = global.RustAST;
  }

  const {
    RustType, RustModule, RustUseDeclaration, RustAttribute,
    RustStruct, RustStructField, RustEnum, RustEnumVariant, RustImpl,
    RustFunction, RustParameter, RustBlock, RustLet, RustExpressionStatement,
    RustReturn, RustIf, RustFor, RustWhile, RustLoop, RustMatch, RustMatchArm,
    RustBreak, RustContinue, RustLiteral, RustIdentifier, RustBinaryExpression,
    RustUnaryExpression, RustAssignment, RustFieldAccess, RustIndex,
    RustMethodCall, RustCall, RustStructLiteral, RustArrayLiteral, RustVecMacro,
    RustCast, RustReference, RustDereference, RustRange, RustTuple, RustClosure,
    RustMacroCall, RustIfExpression, RustBlockExpression, RustDocComment, RustConst
  } = RustAST;

  /**
   * Maps JavaScript/JSDoc types to Rust types
   */
  const TYPE_MAP = {
    // Unsigned integers
    'uint8': 'u8', 'byte': 'u8',
    'uint16': 'u16', 'ushort': 'u16', 'word': 'u16',
    'uint32': 'u32', 'uint': 'u32', 'dword': 'u32',
    'uint64': 'u64', 'ulong': 'u64', 'qword': 'u64',
    // Signed integers
    'int8': 'i8', 'sbyte': 'i8',
    'int16': 'i16', 'short': 'i16',
    'int32': 'i32', 'int': 'i32',
    'int64': 'i64', 'long': 'i64',
    // Floating point
    'float': 'f32', 'float32': 'f32',
    'double': 'f64', 'float64': 'f64',
    // In crypto context, JavaScript 'number' typically means u32 (for bit operations)
    'number': 'u32',
    // Other
    'boolean': 'bool', 'bool': 'bool',
    'string': 'String', 'String': 'String',
    'void': '()',
    'object': 'HashMap<String, u32>',
    'Array': 'Vec'
  };

  /**
   * JavaScript AST to Rust AST Transformer
   *
   * Supported Options:
   * - indent: string - Indentation string (default: '    ')
   * - lineEnding: string - Line ending character (default: '\n')
   * - addComments: boolean - Add doc comments (///). Default: true
   * - useStrictTypes: boolean - Use strict type annotations. Default: true
   * - errorHandling: boolean - Use Result<T, E> for error handling. Default: true
   * - edition: string - Rust edition ('2015', '2018', '2021'). Default: '2021'
   * - useOwnership: boolean - Use proper Rust ownership patterns. Default: true
   * - useTraits: boolean - Generate trait implementations. Default: true
   * - useGenerics: boolean - Use generic types where appropriate. Default: true
   * - useZeroCopy: boolean - Prefer &[u8] over Vec<u8> for read-only data. Default: true
   * - useSIMD: boolean - Enable SIMD optimizations. Default: false
   * - noStd: boolean - Generate code for no_std environments. Default: false
   */
  class RustTransformer {
    constructor(options = {}) {
      this.options = options;
      this.currentStruct = null;
      this.currentImpl = null;
      this.variableTypes = new Map();  // Maps variable name -> RustType
      this.structFieldTypes = new Map(); // Maps field name -> RustType
      this.methodReturnTypes = new Map(); // Maps method name -> RustType
      this.nestedStructs = [];
      this.scopeStack = [];
      this.inConstructor = false;  // Track if we're in a constructor (new() fn)
      this.currentMethodReturnType = null;  // Track return type for wrapping Some()
    }

    /**
     * Convert name to snake_case (Rust convention for variables/functions)
     */
    toSnakeCase(str) {
      if (!str) return str;
      // Ensure str is a string
      if (typeof str !== 'string') {
        str = String(str);
      }
      // Check if it's already UPPER_SNAKE_CASE (like constants)
      if (/^[A-Z][A-Z0-9_]*$/.test(str)) {
        return str.toLowerCase();
      }
      // Handle camelCase and PascalCase
      return str
        // Insert underscore before uppercase letters that follow lowercase letters
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        // Insert underscore before uppercase letters that are followed by lowercase letters
        // (handles acronyms like HTMLParser -> html_parser)
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
        .toLowerCase();
    }

    /**
     * Convert name to snake_case and escape Rust reserved keywords
     * Use this for all method and variable names
     */
    toSafeSnakeCase(str) {
      let name = this.toSnakeCase(str);
      if (this.isRustKeyword(name)) {
        name = name + '_';
      }
      return name;
    }

    /**
     * Check if a name is a Rust reserved keyword
     */
    isRustKeyword(name) {
      const rustKeywords = [
        // Strict keywords
        'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn', 'else', 'enum', 'extern',
        'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub',
        'ref', 'return', 'self', 'Self', 'static', 'struct', 'super', 'trait', 'true', 'type', 'unsafe',
        'use', 'where', 'while',
        // Reserved for future use
        'abstract', 'become', 'box', 'do', 'final', 'macro', 'override', 'priv', 'try', 'typeof', 'unsized',
        'virtual', 'yield'
      ];
      return rustKeywords.includes(name);
    }

    /**
     * Convert name to PascalCase (Rust convention for types)
     */
    toPascalCase(str) {
      if (!str) return str;
      if (typeof str !== 'string')
        str = String(str);
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Convert name to SCREAMING_SNAKE_CASE (Rust convention for constants)
     */
    toScreamingSnakeCase(str) {
      if (!str) return str;
      if (typeof str !== 'string')
        str = String(str);
      // Check if it's already UPPER_SNAKE_CASE
      if (/^[A-Z][A-Z0-9_]*$/.test(str)) {
        return str;
      }
      // Handle camelCase and PascalCase
      return str
        // Insert underscore before uppercase letters that follow lowercase letters
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        // Insert underscore before uppercase letters that are followed by lowercase letters
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
        .toUpperCase();
    }

    /**
     * Map JavaScript type string to Rust type
     */
    mapType(typeName) {
      if (!typeName) return RustType.U32();

      // Handle arrays
      if (typeName.endsWith('[]')) {
        const elementTypeName = typeName.slice(0, -2);
        const elementType = this.mapType(elementTypeName);
        // Use &[T] for zero-copy (read-only), otherwise Vec<T> for owned data
        if (this.options.useZeroCopy) {
          return RustType.Slice(elementType); // &[T] for zero-copy
        } else {
          return RustType.Vec(elementType); // Vec<T> for owned data
        }
      }

      const rustTypeName = TYPE_MAP[typeName] || typeName;

      // Map to Rust types
      const typeMap = {
        'u8': RustType.U8(),
        'u16': RustType.U16(),
        'u32': RustType.U32(),
        'u64': RustType.U64(),
        'i8': RustType.I8(),
        'i16': RustType.I16(),
        'i32': RustType.I32(),
        'i64': RustType.I64(),
        'f32': RustType.F32(),
        'f64': RustType.F64(),
        'bool': RustType.Bool(),
        'String': RustType.String(),
        '()': RustType.Unit()
      };

      return typeMap[rustTypeName] || new RustType(rustTypeName);
    }

    /**
     * Map IL AST result type to Rust type
     * This uses the type information added to IL nodes during JS→IL transformation
     */
    mapILType(ilType) {
      if (!ilType) return null;

      // Handle non-string types (might be an AST node or object)
      if (typeof ilType !== 'string') {
        // Extract type from object if possible
        if (ilType.type) return this.mapILType(ilType.type);
        if (ilType.name) return this.mapILType(ilType.name);
        if (ilType.resultType) return this.mapILType(ilType.resultType);
        return null;
      }

      // Handle array types (e.g., 'uint8[]', 'int32[]')
      if (ilType.endsWith('[]')) {
        const elementType = ilType.slice(0, -2);
        const rustElementType = this.mapILType(elementType);
        return RustType.Vec(rustElementType || RustType.U8());
      }

      // Map IL types to Rust types
      const ilTypeMap = {
        'uint8': RustType.U8(),
        'int8': RustType.I8(),
        'uint16': RustType.U16(),
        'int16': RustType.I16(),
        'uint32': RustType.U32(),
        'int32': RustType.I32(),
        'uint64': RustType.U64(),
        'int64': RustType.I64(),
        'float32': RustType.F32(),
        'float64': RustType.F64(),
        'usize': RustType.Usize(),
        'isize': RustType.Isize(),
        'boolean': RustType.Bool(),
        'bool': RustType.Bool(),
        'string': RustType.String(),
        'void': RustType.Unit(),
        'number': RustType.U32(), // Default for crypto operations
        'any': null, // Will need fallback
        // Also support rust type names directly
        'u8': RustType.U8(),
        'u16': RustType.U16(),
        'u32': RustType.U32(),
        'u64': RustType.U64(),
        'i8': RustType.I8(),
        'i16': RustType.I16(),
        'i32': RustType.I32(),
        'i64': RustType.I64(),
        'f32': RustType.F32(),
        'f64': RustType.F64()
      };

      return ilTypeMap[ilType] || null;
    }

    /**
     * Get type from IL node, with fallback to inference
     * Prioritizes explicit resultType over inference
     */
    getTypeFromILNode(node, fallback = null) {
      if (!node) return fallback;

      // For array expressions, check if elements are object constructors (NewExpression)
      // If so, infer type from the constructor rather than trusting IL type
      if ((node.type === 'ArrayExpression' || node.ilNodeType === 'ArrayLiteral') &&
          node.elements && node.elements.length > 0) {
        const firstElem = node.elements[0];
        if (firstElem?.type === 'NewExpression') {
          let className = null;
          // Handle direct class reference: new ClassName(...)
          if (firstElem.callee?.type === 'Identifier') {
            className = this.toPascalCase(firstElem.callee.name);
          }
          // Handle namespaced class reference: new Namespace.ClassName(...)
          else if (firstElem.callee?.type === 'MemberExpression') {
            const prop = firstElem.callee.property;
            className = this.toPascalCase(prop?.name || prop?.value || 'Unknown');
          }
          if (className) {
            return RustType.Vec(new RustType(className));
          }
        }
      }

      // First priority: explicit resultType from IL transformation
      if (node.resultType) {
        const rustType = this.mapILType(node.resultType);
        if (rustType) return rustType;
      }

      // Second priority: elementType for array nodes
      if (node.elementType && node.elementType !== 'any') {
        const elementRustType = this.mapILType(node.elementType);
        if (elementRustType) return RustType.Vec(elementRustType);
      }

      // Fallback to provided default
      return fallback;
    }

    /**
     * Register a variable's type in the current scope
     */
    registerVariableType(name, type) {
      this.variableTypes.set(name, type);
    }

    /**
     * Get a registered variable's type
     */
    getVariableType(name) {
      return this.variableTypes.get(name) || null;
    }

    /**
     * Get list of variable names that are known to be u32 (crypto accumulators)
     */
    getU32Variables() {
      // Common crypto accumulator variable names that are u32, not usize
      return ['j', 'sum', 'delta', 'rounds', 'v0', 'v1', 'z', 'y', 'e', 'p', 'mx'];
    }

    /**
     * Push a new scope for nested functions
     */
    pushScope() {
      this.scopeStack.push(new Map(this.variableTypes));
    }

    /**
     * Pop scope when leaving nested function
     */
    popScope() {
      if (this.scopeStack.length > 0) {
        this.variableTypes = this.scopeStack.pop();
      }
    }

    /**
     * Infer Rust type from variable name pattern
     */
    inferTypeFromName(name) {
      if (!name) return RustType.U32();

      const lowerName = name.toLowerCase();

      // Boolean-related names (common patterns: isX, hasX, canX, shouldX, etc.)
      if (lowerName.startsWith('is') || lowerName.startsWith('has') ||
          lowerName.startsWith('can') || lowerName.startsWith('should') ||
          lowerName.startsWith('will') || lowerName.startsWith('was') ||
          lowerName.startsWith('did') || lowerName.startsWith('do') ||
          lowerName.includes('flag') || lowerName.includes('enabled') ||
          lowerName.includes('disabled') || lowerName.includes('valid') ||
          lowerName.includes('inverse') || lowerName === 'ok' ||
          lowerName === 'success' || lowerName === 'result') {
        return RustType.Bool();
      }

      // Size/length/index-related names - MUST check BEFORE array patterns
      // to correctly type block_size, key_size, etc. as usize instead of Vec<u8>
      // Note: 'j' removed - it's often a crypto accumulator (u32), not just a loop index
      // Note: 'p' added - commonly used as loop counter in XXTEA and similar algorithms
      if (lowerName.includes('size') || lowerName.includes('length') ||
          lowerName.includes('index') || lowerName.includes('count') ||
          lowerName === 'i' || lowerName === 'n' || lowerName === 'p') {
        return RustType.Usize();
      }

      // Word array names - arrays of 32-bit words (Vec<u32>)
      // IMPORTANT: Check before byte arrays to correctly type "keyWords", "words", etc.
      if (lowerName.includes('words') || lowerName.includes('word_array') ||
          lowerName === 'sbox' || lowerName.includes('sbox') ||
          lowerName.includes('sum0') || lowerName.includes('sum1')) {
        return RustType.Vec(RustType.U32());
      }

      // Array-related names (use slices for crypto data if useZeroCopy is enabled)
      // IMPORTANT: Check these BEFORE 'byte' singular to catch 'keybytes', 'databytes', etc.
      if (lowerName.includes('key') || lowerName.includes('data') ||
          lowerName.includes('input') || lowerName.includes('output') ||
          lowerName.includes('block') || lowerName.includes('bytes') ||
          lowerName.includes('buffer') || lowerName.includes('state')) {
        if (this.options.useZeroCopy) {
          return RustType.Slice(RustType.U8()); // &[u8] for zero-copy
        } else {
          return RustType.Vec(RustType.U8()); // Vec<u8> for owned data
        }
      }

      // Single byte-related names (only match when NOT part of an array pattern)
      if (lowerName === 'byte' || lowerName === 'b' || /^b\d$/.test(lowerName)) {
        return RustType.U8();
      }

      // Crypto operation variables - ensure u32 for bit operations
      // sum, delta, rounds are typically used with u32 in block cipher implementations
      // 'j' is commonly used as a running sum/accumulator in crypto code (not a loop index)
      // Note: 'p' moved to usize loop counters above - it's typically a loop index, not an accumulator
      if (lowerName === 'sum' || lowerName === 'delta' || lowerName === 'rounds' ||
          lowerName === 'v0' || lowerName === 'v1' || lowerName === 'z' || lowerName === 'y' ||
          lowerName === 'j' || lowerName === 'e' ||
          lowerName.startsWith('k') && lowerName.length <= 2) {
        return RustType.U32();
      }

      // Default to u32 for crypto operations
      return RustType.U32();
    }

    /**
     * Transform a JavaScript AST to a Rust AST
     * @param {Object} jsAst - JavaScript AST from parser
     * @returns {RustModule} Rust AST
     */
    transform(jsAst) {
      const module = new RustModule();

      // Add #![no_std] attribute if noStd option is enabled
      if (this.options.noStd) {
        module.attributes.push(new RustAttribute('no_std', [], false)); // false = inner attribute
      }

      // Standard uses for crypto code (skip if noStd is enabled)
      if (!this.options.noStd) {
        module.uses.push(new RustUseDeclaration('std::collections', ['HashMap']));
        module.uses.push(new RustUseDeclaration('std::convert', ['TryInto']));
      }

      // Add framework stub types for algorithm metadata
      if (this.options.includeFrameworkStubs !== false) {
        this.addFrameworkStubs(module);
      }

      // Add module doc comment (respect addComments option)
      if (this.options.addComments !== false) {
        const edition = this.options.edition || '2021';
        const docComment = new RustDocComment(
          `Generated Rust code (Edition ${edition})\nThis file was automatically generated from JavaScript AST`,
          false  // inner doc comment
        );
        module.attributes.push(docComment);
      }

      // Transform the JavaScript AST
      if (jsAst.type === 'Program') {
        for (const node of jsAst.body) {
          this.transformTopLevel(node, module);
        }
      }

      // Add nested structs
      for (const nested of this.nestedStructs) {
        module.items.push(nested);
      }

      // Add main function if not present (for standalone compilation)
      if (this.options.addMainFunction !== false) {
        const hasMain = module.items.some(item =>
          item.type === 'RustFunction' && item.name === 'main'
        );
        if (!hasMain) {
          const mainFn = new RustFunction('main');
          mainFn.returnType = RustType.Unit();
          mainFn.body = new RustBlock();
          // Empty main function
          module.items.push(mainFn);
        }
      }

      return module;
    }

    /**
     * Add framework stub types for algorithm metadata
     * These allow the code to compile without the actual AlgorithmFramework
     */
    addFrameworkStubs(module) {
      // KeySize struct
      const keySize = new RustStruct('KeySize');
      keySize.attributes.push(new RustAttribute('derive', ['Debug', 'Clone', 'Copy']));
      keySize.fields.push(new RustStructField('min_size', RustType.U32()));
      keySize.fields.push(new RustStructField('max_size', RustType.U32()));
      keySize.fields.push(new RustStructField('step', RustType.U32()));
      module.items.push(keySize);

      // KeySize::new impl
      const keySizeImpl = new RustImpl('KeySize');
      const keySizeNew = new RustFunction('new');
      keySizeNew.visibility = 'pub';
      keySizeNew.parameters = [
        new RustParameter('min_size', RustType.U32()),
        new RustParameter('max_size', RustType.U32()),
        new RustParameter('step', RustType.U32())
      ];
      keySizeNew.returnType = new RustType('Self');
      keySizeNew.body = new RustBlock();
      const keySizeSelf = new RustStructLiteral('Self');
      keySizeSelf.fields = [
        { name: 'min_size', value: new RustIdentifier('min_size') },
        { name: 'max_size', value: new RustIdentifier('max_size') },
        { name: 'step', value: new RustIdentifier('step') }
      ];
      keySizeNew.body.statements.push(keySizeSelf);
      keySizeImpl.methods.push(keySizeNew);
      module.items.push(keySizeImpl);

      // LinkItem struct
      const linkItem = new RustStruct('LinkItem');
      linkItem.attributes.push(new RustAttribute('derive', ['Debug', 'Clone']));
      linkItem.fields.push(new RustStructField('text', RustType.String()));
      linkItem.fields.push(new RustStructField('url', RustType.String()));
      module.items.push(linkItem);

      // LinkItem::new impl
      const linkItemImpl = new RustImpl('LinkItem');
      const linkItemNew = new RustFunction('new');
      linkItemNew.visibility = 'pub';
      linkItemNew.parameters = [
        new RustParameter('text', RustType.String()),
        new RustParameter('url', RustType.String())
      ];
      linkItemNew.returnType = new RustType('Self');
      linkItemNew.body = new RustBlock();
      const linkItemSelf = new RustStructLiteral('Self');
      linkItemSelf.fields = [
        { name: 'text', value: new RustIdentifier('text') },
        { name: 'url', value: new RustIdentifier('url') }
      ];
      linkItemNew.body.statements.push(linkItemSelf);
      linkItemImpl.methods.push(linkItemNew);
      module.items.push(linkItemImpl);

      // Vulnerability struct (4 fields: name, url, description, mitigation)
      // JS constructor: (type, url, description, mitigation)
      const vulnerability = new RustStruct('Vulnerability');
      vulnerability.attributes.push(new RustAttribute('derive', ['Debug', 'Clone']));
      vulnerability.fields.push(new RustStructField('name', RustType.String()));
      vulnerability.fields.push(new RustStructField('url', RustType.String()));
      vulnerability.fields.push(new RustStructField('description', RustType.String()));
      vulnerability.fields.push(new RustStructField('mitigation', RustType.String()));
      module.items.push(vulnerability);

      // Vulnerability::new impl - matches JS constructor(type, url, description, mitigation)
      const vulnImpl = new RustImpl('Vulnerability');
      const vulnNew = new RustFunction('new');
      vulnNew.visibility = 'pub';
      vulnNew.parameters = [
        new RustParameter('name', RustType.String()),
        new RustParameter('url', RustType.String()),
        new RustParameter('description', RustType.String()),
        new RustParameter('mitigation', RustType.String())
      ];
      vulnNew.returnType = new RustType('Self');
      vulnNew.body = new RustBlock();
      const vulnSelf = new RustStructLiteral('Self');
      vulnSelf.fields = [
        { name: 'name', value: new RustIdentifier('name') },
        { name: 'url', value: new RustIdentifier('url') },
        { name: 'description', value: new RustIdentifier('description') },
        { name: 'mitigation', value: new RustIdentifier('mitigation') }
      ];
      vulnNew.body.statements.push(vulnSelf);
      vulnImpl.methods.push(vulnNew);
      module.items.push(vulnImpl);

      // CategoryType enum
      const categoryType = new RustEnum('CategoryType');
      categoryType.attributes.push(new RustAttribute('derive', ['Debug', 'Clone', 'Copy', 'PartialEq', 'Eq']));
      for (const variant of ['BLOCK', 'STREAM', 'HASH', 'MAC', 'KDF', 'AEAD', 'ASYMMETRIC', 'ENCODING', 'COMPRESSION', 'CLASSICAL', 'ECC', 'CHECKSUM', 'SPECIAL']) {
        categoryType.variants.push(new RustEnumVariant(variant));
      }
      module.items.push(categoryType);

      // SecurityStatus enum
      const securityStatus = new RustEnum('SecurityStatus');
      securityStatus.attributes.push(new RustAttribute('derive', ['Debug', 'Clone', 'Copy', 'PartialEq', 'Eq']));
      for (const variant of ['SECURE', 'BROKEN', 'DEPRECATED', 'EXPERIMENTAL', 'EDUCATIONAL', 'OBSOLETE']) {
        securityStatus.variants.push(new RustEnumVariant(variant));
      }
      module.items.push(securityStatus);

      // ComplexityType enum (includes BASIC as alias for BEGINNER)
      const complexityType = new RustEnum('ComplexityType');
      complexityType.attributes.push(new RustAttribute('derive', ['Debug', 'Clone', 'Copy', 'PartialEq', 'Eq']));
      for (const variant of ['BEGINNER', 'BASIC', 'INTERMEDIATE', 'ADVANCED', 'EXPERT', 'RESEARCH']) {
        complexityType.variants.push(new RustEnumVariant(variant));
      }
      module.items.push(complexityType);

      // CountryCode enum (common codes)
      const countryCode = new RustEnum('CountryCode');
      countryCode.attributes.push(new RustAttribute('derive', ['Debug', 'Clone', 'Copy', 'PartialEq', 'Eq']));
      for (const variant of ['US', 'GB', 'DE', 'FR', 'IL', 'RU', 'CN', 'JP', 'BE', 'CH', 'NL', 'AU', 'CA', 'KR', 'INTERNATIONAL', 'UNKNOWN']) {
        countryCode.variants.push(new RustEnumVariant(variant));
      }
      module.items.push(countryCode);

      // Value enum for dynamic typing (similar to serde_json::Value)
      // Used for config objects and other dynamic data structures
      const valueEnum = new RustEnum('Value');
      valueEnum.attributes.push(new RustAttribute('derive', ['Debug', 'Clone']));
      valueEnum.variants.push(new RustEnumVariant('Null'));
      valueEnum.variants.push(new RustEnumVariant('Bool', [new RustType('bool')]));
      valueEnum.variants.push(new RustEnumVariant('Number', [new RustType('f64')]));
      valueEnum.variants.push(new RustEnumVariant('String', [new RustType('String')]));
      valueEnum.variants.push(new RustEnumVariant('Array', [new RustType('Vec<Value>')]));
      valueEnum.variants.push(new RustEnumVariant('Object', [new RustType('HashMap<String, Value>')]));
      module.items.push(valueEnum);

      // Add hex module for hex::decode functionality
      const hexDecode = new RustFunction('decode');
      hexDecode.visibility = 'pub';
      hexDecode.parameters = [new RustParameter('s', new RustType('String'))];
      hexDecode.returnType = new RustType('Result<Vec<u8>, String>');
      hexDecode.body = new RustBlock();
      // Implementation: parse hex string to bytes
      const bytesExpr = new RustIdentifier(`(0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i+2], 16).unwrap_or(0)).collect()`);
      hexDecode.body.statements.push(new RustReturn(new RustCall(new RustIdentifier('Ok'), [bytesExpr])));

      // Create Hex module struct as namespace
      const hexModule = new RustStruct('Hex');
      hexModule.isUnit = true;
      hexModule.attributes = [];
      module.items.push(hexModule);

      const hexImpl = new RustImpl('Hex');
      hexImpl.methods.push(hexDecode);
      module.items.push(hexImpl);
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
            // UMD pattern: (function(root, factory) { ... })(...)
            if (callee.type === 'FunctionExpression' ||
                callee.type === 'ArrowFunctionExpression') {
              // Extract and process IIFE body content
              this.transformIIFEContent(callee, node.expression, targetModule);
            }
          }
          break;

        default:
          // Skip unhandled top-level node types
          break;
      }
    }

    /**
     * Extract and transform content from IIFE wrapper
     * Handles multiple patterns:
     * - Simple: (function(global) { ... })(globalThis)
     * - UMD: (function(root, factory) { ... })((function(){...})(), function(deps) { ... })
     */
    transformIIFEContent(calleeNode, callExpr, targetModule) {
      let bodyStatements = [];

      // First, try to find the factory function in UMD pattern
      // UMD pattern: the second argument is usually the factory function
      if (callExpr && callExpr.arguments && callExpr.arguments.length >= 2) {
        const factoryArg = callExpr.arguments[1];
        if (factoryArg.type === 'FunctionExpression' || factoryArg.type === 'ArrowFunctionExpression') {
          // Found UMD factory function - extract from its body
          bodyStatements = factoryArg.body?.body || [];
        }
      }

      // Simple IIFE pattern: extract from callee's body
      if (bodyStatements.length === 0 && calleeNode.body && calleeNode.body.body) {
        bodyStatements = calleeNode.body.body;
      }

      // Process statements
      for (const stmt of bodyStatements) {
        // Skip 'use strict' and other expression statements
        if (stmt.type === 'ExpressionStatement') {
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

        // Skip if statements (usually feature detection)
        if (stmt.type === 'IfStatement') continue;
      }
    }

    /**
     * Transform a variable declaration
     */
    transformVariableDeclaration(node, targetModule) {
      for (const decl of node.declarations) {
        if (!decl.init) continue;

        // Skip ObjectPattern destructuring (e.g., const { RegisterAlgorithm } = AlgorithmFramework)
        if (decl.id.type === 'ObjectPattern')
          continue;

        // Handle array destructuring: const [a, b, c] = arr;
        if (decl.id.type === 'ArrayPattern') {
          const sourceExpr = decl.init ? this.transformExpression(decl.init) : null;
          if (sourceExpr) {
            for (let i = 0; i < decl.id.elements.length; ++i) {
              const elem = decl.id.elements[i];
              if (!elem) continue; // Skip holes in destructuring

              const varName = this.toSnakeCase(elem.name);
              const indexExpr = new RustIndexExpression(sourceExpr, RustLiteral.UInt(i, 'usize'));
              const constDecl = new RustConst(
                node.kind === 'const' ? this.toScreamingSnakeCase(elem.name) : varName,
                new RustType('_'), // Type inference
                indexExpr
              );
              targetModule.items.push(constDecl);
            }
          }
          continue;
        }

        const name = decl.id.name;

        // Check if this is an object literal defining a module/struct
        if (decl.init.type === 'ObjectExpression') {
          const struct = this.transformObjectToStruct(name, decl.init);
          if (struct) {
            targetModule.items.push(struct);
          }
        }
        // Check if this is an IIFE (immediately invoked function expression)
        else if (decl.init.type === 'CallExpression' &&
                 (decl.init.callee.type === 'FunctionExpression' ||
                  decl.init.callee.type === 'ArrowFunctionExpression')) {
          // Extract return value from IIFE
          const returnValue = this.getIIFEReturnValue(decl.init);
          if (returnValue) {
            const constDecl = new RustConst(
              this.toScreamingSnakeCase(name),
              this.inferTypeFromValue(returnValue),
              this.transformExpression(returnValue)
            );
            targetModule.items.push(constDecl);
          }
        }
        // Handle simple literals and expressions as static constants
        else if (decl.init.type === 'Literal' ||
                 decl.init.type === 'ArrayExpression' ||
                 decl.init.type === 'UnaryExpression' ||
                 decl.init.type === 'BinaryExpression') {
          const constDecl = new RustConst(
            this.toScreamingSnakeCase(name),
            this.inferTypeFromValue(decl.init),
            this.transformExpression(decl.init)
          );
          targetModule.items.push(constDecl);
        }
        // Skip NewExpression for top-level const - Rust can't call non-const fn in const context
        // These are typically algorithm instance registrations that aren't needed in the generated code
        else if (decl.init.type === 'NewExpression') {
          // Skip - Rust doesn't support calling constructors in const context
          // Could use lazy_static or OnceCell if needed in the future
        }
      }
    }

    /**
     * Transform an object literal to a Rust struct
     */
    transformObjectToStruct(name, objNode) {
      const struct = new RustStruct(this.toPascalCase(name));
      struct.attributes.push(new RustAttribute('derive', ['Debug', 'Clone']));

      // Create impl block for methods
      const impl = new RustImpl(struct.name);

      const prevStruct = this.currentStruct;
      const prevImpl = this.currentImpl;
      this.currentStruct = struct;
      this.currentImpl = impl;

      for (const prop of objNode.properties) {
        const propName = prop.key.name || prop.key.value;
        const propValue = prop.value;

        if (prop.method || propValue.type === 'FunctionExpression' || propValue.type === 'ArrowFunctionExpression') {
          // Method
          const method = this.transformFunctionToMethod(propName, propValue);
          impl.methods.push(method);
        } else {
          // Field
          const field = this.transformToField(propName, propValue);
          struct.fields.push(field);
        }
      }

      this.currentStruct = prevStruct;
      this.currentImpl = prevImpl;

      // Add impl block if it has methods
      if (impl.methods.length > 0) {
        this.nestedStructs.push(impl);
      }

      return struct;
    }

    /**
     * Transform a field
     */
    transformToField(name, valueNode) {
      const fieldName = this.toSnakeCase(name);
      const fieldType = this.inferTypeFromValue(valueNode);

      const field = new RustStructField(fieldName, fieldType);
      this.structFieldTypes.set(fieldName, fieldType);

      return field;
    }

    /**
     * Infer Rust type from a JavaScript value expression
     */
    inferTypeFromValue(valueNode) {
      if (!valueNode) return RustType.U32();

      // First priority: use type from IL node if available (resultType or elementType)
      const ilType = this.getTypeFromILNode(valueNode);
      if (ilType) return ilType;

      switch (valueNode.type) {
        case 'Literal':
          if (valueNode.value === null || valueNode.value === undefined) {
            // Return null to indicate nullable - caller should wrap in Option
            return null;
          }
          if (typeof valueNode.value === 'number') {
            if (Number.isInteger(valueNode.value)) {
              return valueNode.value >= 0 ? RustType.U32() : RustType.I32();
            }
            return RustType.F64();
          }
          if (typeof valueNode.value === 'string') return RustType.String(); // Use owned String for struct fields
          if (typeof valueNode.value === 'boolean') return RustType.Bool();
          return RustType.U32();

        case 'ArrayExpression':
          if (valueNode.elements.length > 0) {
            let firstElem = valueNode.elements[0];
            // Handle spread elements: [...v0Bytes, ...v1Bytes] -> look at what's being spread
            if (firstElem?.type === 'SpreadElement') {
              // Spread of byte array -> result is Vec<u8>
              const spreadType = this.inferTypeFromValue(firstElem.argument);
              // If spreading a Vec<T>, the concat result is also Vec<T>
              if (spreadType.name === 'Vec' && spreadType.genericArguments?.[0]) {
                return spreadType;
              }
              // Check the name of what's being spread
              if (firstElem.argument?.type === 'Identifier') {
                const argName = firstElem.argument.name.toLowerCase();
                if (argName.includes('bytes') || argName.includes('block') ||
                    argName.includes('data') || argName.includes('buffer')) {
                  return RustType.Vec(RustType.U8());
                }
              }
            }
            const elemType = this.inferTypeFromValue(firstElem);
            // Always use Vec for array literals (they are owned values)
            // useZeroCopy only affects parameter types and variable inference
            return RustType.Vec(elemType);
          }
          return RustType.Vec(RustType.U8());

        case 'ArrayCreation':
          // IL AST node for new Array(size) - infer element type from elementType or default
          if (valueNode.elementType && valueNode.elementType !== 'any') {
            // Map element type string to RustType
            switch (valueNode.elementType) {
              case 'number':
              case 'u32':
              case 'dword':
                return RustType.Vec(RustType.U32());
              case 'u8':
              case 'byte':
                return RustType.Vec(RustType.U8());
              case 'u16':
                return RustType.Vec(RustType.U16());
              case 'u64':
                return RustType.Vec(RustType.U64());
              default:
                return RustType.Vec(RustType.U32());
            }
          }
          // Default to Vec<u32> for generic arrays
          return RustType.Vec(RustType.U32());

        case 'TypedArrayCreation':
          // IL AST node for new Uint8Array(size), new Uint32Array(size), etc.
          if (valueNode.arrayType) {
            switch (valueNode.arrayType) {
              case 'Uint8Array':
              case 'Int8Array':
                return RustType.Vec(RustType.U8());
              case 'Uint16Array':
              case 'Int16Array':
                return RustType.Vec(RustType.U16());
              case 'Uint32Array':
              case 'Int32Array':
                return RustType.Vec(RustType.U32());
              case 'BigUint64Array':
              case 'BigInt64Array':
                return RustType.Vec(RustType.U64());
              default:
                return RustType.Vec(RustType.U8());
            }
          }
          return RustType.Vec(RustType.U8());

        case 'Identifier': {
          // First check if we have a registered type for this variable
          const registeredType = this.getVariableType(valueNode.name);
          if (registeredType)
            return registeredType;
          // Fall back to name-based inference
          return this.inferTypeFromName(valueNode.name);
        }

        case 'NewExpression':
          // new ClassName() -> returns ClassName type
          if (valueNode.callee?.type === 'Identifier') {
            const calleeName = valueNode.callee.name;
            // Special handling for Array constructor: new Array(size) -> Vec<u32>
            if (calleeName === 'Array') {
              // Try to infer element type from arguments or default to u32
              return RustType.Vec(RustType.U32());
            }
            // Special handling for typed arrays
            if (calleeName === 'Uint8Array' || calleeName === 'Int8Array') {
              return RustType.Vec(RustType.U8());
            }
            if (calleeName === 'Uint16Array' || calleeName === 'Int16Array') {
              return RustType.Vec(RustType.U16());
            }
            if (calleeName === 'Uint32Array' || calleeName === 'Int32Array') {
              return RustType.Vec(RustType.U32());
            }
            if (calleeName === 'BigUint64Array' || calleeName === 'BigInt64Array') {
              return RustType.Vec(RustType.U64());
            }
            const className = this.toPascalCase(calleeName);
            return new RustType(className);
          }
          if (valueNode.callee?.type === 'MemberExpression') {
            const className = this.toPascalCase(valueNode.callee.property?.name || 'Unknown');
            return new RustType(className);
          }
          return RustType.U32();

        case 'CallExpression':
          // Check if it's a constructor-like call: ClassName.new(...)
          if (valueNode.callee?.type === 'MemberExpression' &&
              valueNode.callee?.property?.name === 'new') {
            const className = this.toPascalCase(valueNode.callee.object?.name);
            return new RustType(className);
          }
          // Check for format/format! calls - these return String
          if (valueNode.callee?.type === 'Identifier' &&
              (valueNode.callee.name === 'format' || valueNode.callee.name === 'format!')) {
            return RustType.String();
          }
          // Check for methods that typically return strings
          if (valueNode.callee?.type === 'MemberExpression') {
            const methodName = valueNode.callee.property?.name || valueNode.callee.property?.value;
            const objName = valueNode.callee.object?.name;
            // String.fromCharCode returns a char
            if ((objName === 'String' || objName === 'string') &&
                (methodName === 'fromCharCode' || methodName === 'from_char_code')) {
              return RustType.Char();
            }
            if (['toString', 'toUpperCase', 'toLowerCase', 'trim', 'slice',
                 'substring', 'substr', 'replace', 'join'].includes(methodName)) {
              return RustType.String();
            }
            // Config-like methods (getVariantConfig, getConfig, etc.) return HashMap-like objects
            if (methodName && (methodName.toLowerCase().includes('config') ||
                methodName.toLowerCase().includes('variant'))) {
              return new RustType('HashMap<String, Value>');
            }
          }
          // this.methodName() - try to infer from method name
          if (valueNode.callee?.type === 'ThisMethodCall') {
            const methodName = valueNode.callee.method;
            if (methodName && methodName.toLowerCase().includes('config')) {
              return new RustType('HashMap<String, Value>');
            }
          }
          return RustType.U32();

        case 'TemplateLiteral':
          // Template literals always produce strings
          return RustType.String();

        case 'StringInterpolation':
          // IL AST node for template strings
          return RustType.String();

        case 'ThisMethodCall':
          // IL AST node: this.methodName(args)
          if (valueNode.method) {
            const methodName = valueNode.method;
            const lowerMethod = methodName.toLowerCase();
            // Methods that return arrays of words (Vec<u32>)
            if (lowerMethod.includes('words') || lowerMethod.includes('word_array') ||
                lowerMethod.includes('keywords'))
              return RustType.Vec(RustType.U32());
            // Block cipher methods return Vec<u8>
            if (lowerMethod.includes('encrypt') || lowerMethod.includes('decrypt') ||
                lowerMethod.includes('block') || lowerMethod.includes('process') ||
                lowerMethod === 'result' || lowerMethod === 'feed')
              return RustType.Vec(RustType.U8());
            // Check registered method return types
            const registeredType = this.methodReturnTypes.get(methodName);
            if (registeredType) return registeredType;
            // Config-like methods return HashMap-like objects
            if (lowerMethod.includes('config') || lowerMethod.includes('variant'))
              return new RustType('HashMap<String, Value>');
            // String-returning methods
            if (['toString', 'toUpperCase', 'toLowerCase', 'trim'].includes(methodName))
              return RustType.String();
          }
          return RustType.U32();

        case 'OpCodesCall': {
          // IL AST node: OpCodes.Method(args)
          const method = valueNode.method || valueNode.callee?.property?.name;
          // CopyArray/CloneArray returns the same type as its argument
          if (method === 'CopyArray' || method === 'CloneArray') {
            const argNode = valueNode.arguments?.[0];
            if (argNode) {
              return this.inferTypeFromValue(argNode);
            }
          }
          // XorArrays returns Vec<u8>
          if (method === 'XorArrays') {
            return RustType.Vec(RustType.U8());
          }
          // Hex8ToBytes returns Vec<u8>
          if (method === 'Hex8ToBytes') {
            return RustType.Vec(RustType.U8());
          }
          // Pack operations return u32 or similar
          if (method && method.includes('Pack')) {
            if (method.includes('16')) return RustType.U16();
            if (method.includes('64')) return RustType.U64();
            return RustType.U32();
          }
          // Unpack operations return Vec<u8>
          if (method && method.includes('Unpack')) {
            return RustType.Vec(RustType.U8());
          }
          // Rotation operations return the same type
          if (method && (method.includes('Rot') || method.includes('Shr') || method.includes('Shl'))) {
            return RustType.U32();
          }
          return RustType.U32();
        }

        case 'ObjectExpression':
          // Object literal - use HashMap or a generated struct
          return new RustType('HashMap<String, Value>');

        case 'ConditionalExpression':
          // For ternary, infer from consequent branch
          return this.inferTypeFromValue(valueNode.consequent);

        case 'LogicalExpression':
          // For JavaScript || operator, it returns first truthy value (not boolean)
          // So the type should be the type of the operands, not bool
          // In JS: config[x] || config["default"] returns the config object type
          // For &&, in JS it returns the last truthy value or first falsy value
          if (valueNode.operator === '||' || valueNode.operator === '&&') {
            const leftType = this.inferTypeFromValue(valueNode.left);
            const rightType = this.inferTypeFromValue(valueNode.right);
            // If left type is bool, this is a real boolean expression
            if (leftType && leftType.name === 'bool')
              return RustType.Bool();
            // Otherwise, return the left type (for ||) as the null-coalescing result
            if (leftType && leftType.name !== 'undefined')
              return leftType;
            // Fallback to right type if left is unknown
            if (rightType && rightType.name !== 'undefined')
              return rightType;
          }
          // Fallback for unknown patterns - don't default to bool, return U32
          return RustType.U32();

        case 'BinaryExpression':
          // For binary ops like + - * / % etc.
          // String concatenation
          if (valueNode.operator === '+') {
            const leftType = this.inferTypeFromValue(valueNode.left);
            if (leftType.name === 'String') return RustType.String();
          }
          // Comparison ops return bool
          if (['==', '!=', '===', '!==', '<', '>', '<=', '>='].includes(valueNode.operator)) {
            return RustType.Bool();
          }
          // Arithmetic ops - infer from left
          return this.inferTypeFromValue(valueNode.left);

        case 'Cast':
        case 'TypeConversion': {
          // Cast/TypeConversion - return the target type
          const targetType = valueNode.targetType || valueNode.toType || 'u32';
          const typeMap = {
            'int32': RustType.I32(), 'int': RustType.I32(),
            'uint32': RustType.U32(), 'uint': RustType.U32(), 'dword': RustType.U32(),
            'int8': RustType.I8(), 'uint8': RustType.U8(), 'byte': RustType.U8(),
            'int16': RustType.I16(), 'uint16': RustType.U16(),
            'int64': RustType.I64(), 'uint64': RustType.U64(),
            'i32': RustType.I32(), 'u32': RustType.U32(),
            'i8': RustType.I8(), 'u8': RustType.U8(),
            'i16': RustType.I16(), 'u16': RustType.U16(),
            'i64': RustType.I64(), 'u64': RustType.U64(),
            'usize': RustType.Usize(), 'isize': RustType.Isize()
          };
          return typeMap[targetType] || RustType.U32();
        }

        case 'MemberExpression': {
          // Handle enum variant access: CategoryType.BLOCK, SecurityStatus.SECURE, etc.
          const frameworkEnums = ['CategoryType', 'SecurityStatus', 'ComplexityType', 'CountryCode'];

          // Handle computed array indexing: return element type
          // For arr[i] where arr is Vec<T>, return T
          if (valueNode.computed) {
            // Check if object is an identifier or field access
            const objType = this.inferTypeFromValue(valueNode.object);
            if (objType && objType.name === 'Vec' && objType.genericArguments?.[0]) {
              // Return the element type
              return objType.genericArguments[0];
            }
          }

          // Direct access: CategoryType.BLOCK
          if (valueNode.object?.type === 'Identifier') {
            const objectName = valueNode.object.name;
            if (frameworkEnums.includes(objectName)) {
              return new RustType(objectName);
            }
            // Computed access on an identifier: configs[variant] -> HashMap value type
            // When accessing a hash map, the result is the value type
            if (valueNode.computed) {
              // If the variable is known to be a HashMap, return the value type
              const varType = this.getVariableType(objectName);
              if (varType && varType.name.startsWith('HashMap')) {
                // Return the value type of the HashMap
                return new RustType('HashMap<String, Value>'); // Nested objects are also HashMaps
              }
              // Check variable name patterns for config-like objects
              const lowerName = objectName.toLowerCase();
              if (lowerName.includes('config') || lowerName === 'options' ||
                  lowerName === 'settings' || lowerName === 'params') {
                return new RustType('HashMap<String, Value>');
              }
            }
          }

          // Nested access: AlgorithmFramework.CategoryType.BLOCK
          if (valueNode.object?.type === 'MemberExpression') {
            const innerProp = valueNode.object.property?.name || valueNode.object.property?.value;
            if (innerProp && frameworkEnums.includes(innerProp)) {
              return new RustType(innerProp);
            }
          }

          // Property access on config-like objects: config.description
          if (valueNode.object?.type === 'Identifier') {
            const objName = valueNode.object.name.toLowerCase();
            if (objName.includes('config') || objName === 'options' || objName === 'settings') {
              const propName = valueNode.property?.name || valueNode.property?.value;
              // Infer property type based on common patterns
              if (propName) {
                const lowerProp = propName.toLowerCase();
                if (lowerProp.includes('description') || lowerProp.includes('name') ||
                    lowerProp.includes('text') || lowerProp.includes('title')) {
                  return RustType.String();
                }
                if (lowerProp.includes('complexity')) {
                  return new RustType('ComplexityType');
                }
                // Numbers (size, bits, etc.)
                return RustType.U32();
              }
            }
          }

          return RustType.U32();
        }

        case 'ThisPropertyAccess': {
          // this.property -> look up field type from struct field registry
          const fieldName = this.toSnakeCase(valueNode.property);
          const fieldType = this.structFieldTypes.get(fieldName);
          if (fieldType) {
            return fieldType;
          }
          // Fall back to name-based inference
          return this.inferTypeFromName(valueNode.property);
        }

        // Pack operations return appropriate integer types
        case 'Pack32LE':
        case 'Pack32BE':
          return RustType.U32();

        case 'Pack16LE':
        case 'Pack16BE':
          return RustType.U16();

        case 'Pack64LE':
        case 'Pack64BE':
          return RustType.U64();

        // IL PackBytes node - determine type from bits field
        case 'PackBytes': {
          const bits = valueNode.bits || 32;
          if (bits === 16) return RustType.U16();
          if (bits === 64) return RustType.U64();
          return RustType.U32();
        }

        default:
          return RustType.U32();
      }
    }

    /**
     * Transform a function declaration
     */
    transformFunctionDeclaration(node, targetModule) {
      const funcName = this.toSnakeCase(node.id.name);
      const func = new RustFunction(funcName);

      // Infer return type (default to unit)
      func.returnType = RustType.Unit();

      // Parameters
      if (node.params) {
        for (const param of node.params) {
          const paramName = this.toSnakeCase(param.name);
          const paramType = this.inferTypeFromName(param.name);
          const rustParam = new RustParameter(paramName, paramType);
          func.parameters.push(rustParam);

          this.registerVariableType(param.name, paramType);
        }
      }

      // Body
      if (node.body) {
        func.body = this.transformBlockStatement(node.body);
      }

      targetModule.items.push(func);
    }

    /**
     * Transform a function to a method
     */
    transformFunctionToMethod(name, funcNode) {
      const methodName = this.toSafeSnakeCase(name);
      const method = new RustFunction(methodName);

      // Add &self parameter for instance methods
      method.isSelfMethod = true;
      method.selfParameter = '&self';

      // Infer return type
      method.returnType = RustType.Unit();

      // Parameters (excluding self)
      if (funcNode.params) {
        for (const param of funcNode.params) {
          const paramName = this.toSnakeCase(param.name);
          const paramType = this.inferTypeFromName(param.name);
          const rustParam = new RustParameter(paramName, paramType);
          method.parameters.push(rustParam);

          this.registerVariableType(param.name, paramType);
        }
      }

      // Body
      if (funcNode.body) {
        method.body = this.transformBlockStatement(funcNode.body);
      }

      return method;
    }

    /**
     * Transform a class declaration to a Rust struct
     */
    transformClassDeclaration(node, targetModule) {
      const className = this.toPascalCase(node.id.name);
      const struct = new RustStruct(className);
      struct.attributes.push(new RustAttribute('derive', ['Debug', 'Clone']));

      const impl = new RustImpl(className);

      const prevStruct = this.currentStruct;
      const prevImpl = this.currentImpl;
      this.currentStruct = struct;
      this.currentImpl = impl;

      // Handle both class body structures:
      // - Standard: {type: 'ClassBody', body: [...]}
      // - Unwrapped UMD: array directly
      const members = node.body?.body || node.body || [];

      // First pass: collect all fields (constructor + other methods)
      let constructorFields = [];
      let constructorInitStatements = [];
      let constructorMember = null;
      let additionalFields = [];

      if (members && members.length > 0) {
        // Find constructor and extract its fields
        for (const member of members) {
          if (member.type === 'MethodDefinition' && member.kind === 'constructor') {
            constructorMember = member;
            const { fields, initStatements } = this.extractFieldsFromConstructor(member);
            constructorFields = fields;
            constructorInitStatements = initStatements;
            break;
          }
        }

        // Add constructor fields to struct
        for (const field of constructorFields) {
          struct.fields.push(field);
        }

        // Scan all methods for additional field assignments
        additionalFields = this.extractAdditionalFieldsFromMethods(members, constructorFields);
        for (const field of additionalFields) {
          struct.fields.push(field);
        }
      }

      // Pre-scan: collect all methods called via this.method() anywhere in the class
      // These methods need &self even if their body doesn't use 'this'
      this.methodsCalledViaSelf = new Set();
      if (members && members.length > 0) {
        for (const member of members) {
          if (member.type === 'MethodDefinition' && member.value?.body) {
            this.collectThisMethodCalls(member.value.body);
          }
        }
      }

      // Second pass: transform methods
      if (members && members.length > 0) {
        for (const member of members) {
          if (member.type === 'MethodDefinition') {
            if (member.kind === 'constructor') {
              // Create 'new' method from constructor, passing additional fields to init as None
              const ctor = this.transformConstructor(member, constructorInitStatements, additionalFields);
              impl.methods.push(ctor);
            } else if (member.kind === 'get') {
              // Getter: transform to get_property_name() method
              const method = this.transformGetterMethod(member);
              impl.methods.push(method);
            } else if (member.kind === 'set') {
              // Setter: transform to set_property_name(&mut self, value)
              const method = this.transformSetterMethod(member);
              impl.methods.push(method);
            } else {
              // Regular method
              const method = this.transformMethodDefinition(member);
              impl.methods.push(method);
            }
          } else if (member.type === 'PropertyDefinition') {
            // Field
            const field = this.transformPropertyDefinition(member);
            struct.fields.push(field);
          } else if (member.type === 'StaticBlock') {
            // ES2022 static block -> Rust doesn't have static class blocks
            // Transform to module-level statements or lazy_static
            const initStatements = this.transformStaticBlock(member);
            if (initStatements) {
              struct.staticInitStatements = struct.staticInitStatements || [];
              struct.staticInitStatements.push(...initStatements);
            }
          }
        }
      }

      this.currentStruct = prevStruct;
      this.currentImpl = prevImpl;

      targetModule.items.push(struct);
      if (impl.methods.length > 0) {
        targetModule.items.push(impl);
      }
    }

    /**
     * Check if a statement is a this.property = value assignment
     */
    isThisPropertyAssignment(stmt) {
      if (stmt.type !== 'ExpressionStatement') return false;
      const expr = stmt.expression;
      if (expr.type !== 'AssignmentExpression') return false;
      // Handle both standard JS AST (MemberExpression) and IL AST (ThisPropertyAccess)
      if (expr.left.type === 'ThisPropertyAccess') return true;
      if (expr.left.type === 'MemberExpression' && expr.left.object?.type === 'ThisExpression') return true;
      return false;
    }

    /**
     * Extract fields from constructor's this.x = y assignments
     */
    extractFieldsFromConstructor(node) {
      const fields = [];
      const initStatements = [];

      if (!node.value || !node.value.body || node.value.body.type !== 'BlockStatement')
        return { fields, initStatements };

      for (const stmt of node.value.body.body) {
        if (this.isThisPropertyAssignment(stmt)) {
          const expr = stmt.expression;
          // Handle both MemberExpression (property.name/value) and ThisPropertyAccess (property is string)
          const propName = expr.left.type === 'ThisPropertyAccess'
            ? expr.left.property
            : (expr.left.property.name || expr.left.property.value);
          const isPrivate = propName.startsWith('_');

          // Convert field name to snake_case, removing leading underscore
          let fieldName = this.toSnakeCase(propName);
          if (fieldName.startsWith('_'))
            fieldName = fieldName.substring(1);

          // Skip test vectors - they have mixed types (String and Vec<u8>) that don't work with HashMap
          if (fieldName === 'tests' || fieldName === 'test_vectors') {
            continue;
          }

          const value = expr.right;

          // Infer field type from value first
          let fieldType = this.inferTypeFromValue(value);

          // For numeric values, also check if field name suggests a specific type
          // (size/length/index/count fields should be usize, not u32)
          // (rounds/delta/sum fields should be u32, not i32 for crypto)
          // IMPORTANT: Only override with size-related types or u32, NOT with bool or other types
          if (value.type === 'Literal' && typeof value.value === 'number') {
            const nameBasedType = this.inferTypeFromName(propName);
            // Use name-based type for: usize (sizes), and u32 when inferred i32 (crypto vars)
            if (nameBasedType.name === 'usize' || nameBasedType.name === 'isize' ||
                (nameBasedType.name === 'u32' && fieldType.name === 'i32'))
              fieldType = nameBasedType;
          }

          // For empty arrays assigned to buffer/data/input fields, use Vec<u8> instead of inferred int type
          if (value.type === 'ArrayExpression' && (!value.elements || value.elements.length === 0)) {
            const lowerName = propName.toLowerCase();
            if (lowerName.includes('buffer') || lowerName.includes('data') ||
                lowerName.includes('block') || lowerName.includes('input') ||
                lowerName.includes('output') || lowerName.includes('bytes'))
              fieldType = RustType.Vec(RustType.U8());
          }

          // Special handling for null initializations - use Option<T>
          if (value.type === 'Literal' && value.value === null) {
            const lowerName = propName.toLowerCase();
            if (lowerName.includes('buffer') || lowerName.includes('data') ||
                lowerName.includes('block') || lowerName.includes('key') ||
                lowerName.includes('input') || lowerName.includes('output') ||
                lowerName.includes('bytes') || lowerName.includes('iv') ||
                lowerName.includes('nonce'))
              fieldType = RustType.Option(RustType.Vec(RustType.U8()));
            else if (lowerName.includes('state') || lowerName === '_h' || lowerName === '_w' ||
                     lowerName === '_m' || lowerName === '_s' ||
                     // Crypto numeric arrays: sum0, sum1, keyWords, sbox, etc.
                     lowerName.includes('sum') || lowerName.includes('words') ||
                     lowerName.includes('sbox') || lowerName.includes('table'))
              fieldType = RustType.Option(RustType.Vec(RustType.U32()));
            else if (lowerName.includes('length') || lowerName.includes('count') || lowerName.includes('size'))
              fieldType = RustType.Usize();
            else
              fieldType = RustType.Option(RustType.U32());
          }

          const field = new RustStructField(fieldName, fieldType);
          field.visibility = isPrivate ? 'pub(crate)' : 'pub';
          fields.push(field);
          this.structFieldTypes.set(fieldName, fieldType);

          initStatements.push(stmt);
        }
      }

      return { fields, initStatements };
    }

    /**
     * Scan all methods (non-constructor) for this.property = ... assignments
     * that create new fields not already known from the constructor
     */
    extractAdditionalFieldsFromMethods(members, knownFields) {
      const additionalFields = [];
      const knownFieldNames = new Set(knownFields.map(f => f.name));

      for (const member of members) {
        if (member.type !== 'MethodDefinition' || member.kind === 'constructor')
          continue;

        // Scan method body for this.property = assignments
        const body = member.value?.body;
        if (!body || body.type !== 'BlockStatement')
          continue;

        this.scanBlockForFieldAssignments(body, knownFieldNames, additionalFields);
      }

      return additionalFields;
    }

    /**
     * Recursively scan a block for this.property = assignments
     */
    scanBlockForFieldAssignments(block, knownFieldNames, additionalFields) {
      if (!block || !block.body) return;

      for (const stmt of block.body) {
        if (this.isThisPropertyAssignment(stmt)) {
          const expr = stmt.expression;
          // Handle both IL AST (ThisPropertyAccess) and standard AST (MemberExpression)
          let propertyName;
          if (expr.left.type === 'ThisPropertyAccess') {
            propertyName = expr.left.property;
          } else if (expr.left.type === 'MemberExpression') {
            propertyName = expr.left.property?.name || expr.left.property?.value;
          }

          if (!propertyName) continue;

          const fieldName = this.toSnakeCase(propertyName);
          if (knownFieldNames.has(fieldName)) continue;

          // Skip None assignments - we need to find the actual value assignment
          if (expr.right?.type === 'Literal' && expr.right?.value === null) {
            // Mark as needing Option wrapper but don't create field yet
            continue;
          }
          if (expr.right?.type === 'Identifier' && expr.right?.name === 'null') {
            continue;
          }

          // Infer type from the assigned value
          let fieldType = this.inferTypeFromValue(expr.right);

          // Make it Option if it could be null/None based on patterns
          const lowerName = fieldName.toLowerCase();
          // Key/IV/Nonce fields are typically byte arrays wrapped in Option
          if (lowerName === 'key' || lowerName.includes('_key') ||
              lowerName === 'iv' || lowerName === 'nonce') {
            fieldType = RustType.Option(RustType.Vec(RustType.U8()));
          } else if (lowerName.includes('key_word') || lowerName.includes('keyword') ||
              lowerName.includes('sum') || lowerName.includes('words') ||
              lowerName.includes('state') || lowerName.includes('sbox') ||
              lowerName.includes('table')) {
            // Crypto numeric arrays - override element type to u32
            fieldType = RustType.Option(RustType.Vec(RustType.U32()));
          }

          const isPrivate = propertyName.startsWith('_');
          const field = new RustStructField(fieldName, fieldType);
          field.visibility = isPrivate ? 'pub(crate)' : 'pub';
          additionalFields.push(field);
          knownFieldNames.add(fieldName);
          this.structFieldTypes.set(fieldName, fieldType);
        }

        // Recursively scan nested blocks
        if (stmt.type === 'IfStatement') {
          if (stmt.consequent?.type === 'BlockStatement')
            this.scanBlockForFieldAssignments(stmt.consequent, knownFieldNames, additionalFields);
          if (stmt.alternate?.type === 'BlockStatement')
            this.scanBlockForFieldAssignments(stmt.alternate, knownFieldNames, additionalFields);
        } else if (stmt.type === 'WhileStatement' || stmt.type === 'ForStatement' ||
                   stmt.type === 'ForOfStatement' || stmt.type === 'ForInStatement') {
          if (stmt.body?.type === 'BlockStatement')
            this.scanBlockForFieldAssignments(stmt.body, knownFieldNames, additionalFields);
        }
      }
    }

    /**
     * Transform a constructor to a 'new' method
     * @param {Object} node - Constructor node
     * @param {Array} fieldInitStatements - Field init statements from constructor
     * @param {Array} additionalFields - Additional fields discovered from methods that need None init
     */
    transformConstructor(node, fieldInitStatements = [], additionalFields = []) {
      // Mark that we're in a constructor - this affects how this.method() is transformed
      // In Rust new() is an associated function, not a method, so we can't use self
      const wasInConstructor = this.inConstructor;
      this.inConstructor = true;

      const ctor = new RustFunction('new');
      ctor.returnType = new RustType('Self');

      // Parameters - skip 'algorithm' parameter which is only used for parent constructor
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          // Skip the 'algorithm' parameter - it's only passed to super() which we don't support
          if (param.name === 'algorithm') continue;

          const paramName = this.toSnakeCase(param.name);
          const paramType = this.inferTypeFromName(param.name);
          const rustParam = new RustParameter(paramName, paramType);
          ctor.parameters.push(rustParam);

          this.registerVariableType(param.name, paramType);
        }
      }

      // Collect field initializers for struct literal
      const fieldInits = [];
      const body = new RustBlock();

      // Track fields that need to be extracted as local variables
      // (fields that are accessed via this.fieldName.property before the struct is built)
      this.constructorLocals = new Map();

      // Pre-scan: identify fields that are accessed via this.X.Y pattern
      // These need to be extracted to local variables first
      if (node.value && node.value.body && node.value.body.type === 'BlockStatement') {
        const stmts = node.value.body.body;
        const fieldAssignmentOrder = [];

        // First pass: collect field assignment order and find cross-references
        for (const stmt of stmts) {
          if (this.isThisPropertyAssignment(stmt)) {
            const expr = stmt.expression;
            const propName = expr.left.type === 'ThisPropertyAccess'
              ? expr.left.property
              : (expr.left.property.name || expr.left.property.value);
            let fieldName = this.toSnakeCase(propName);
            if (fieldName.startsWith('_')) fieldName = fieldName.substring(1);
            fieldAssignmentOrder.push({ fieldName, propName, value: expr.right, stmt });

            // Check if any previous field is referenced in this value expression
            this.findThisFieldAccesses(expr.right, fieldAssignmentOrder);
          }
        }

        // Extract fields that are accessed before struct is built
        for (const [localName, info] of this.constructorLocals) {
          // Find the original value expression for this field
          const fieldInfo = fieldAssignmentOrder.find(f => f.fieldName === localName);
          if (fieldInfo) {
            // RustLet(pattern, type, initializer) - use null for type to let Rust infer
            const localVar = new RustLet(localName, null, this.transformExpression(fieldInfo.value));
            body.statements.push(localVar);
          }
        }

        // Now process all statements
        for (const stmt of stmts) {
          if (this.isThisPropertyAssignment(stmt)) {
            // Collect field initializer for struct literal
            const expr = stmt.expression;
            // Handle both MemberExpression (property.name/value) and ThisPropertyAccess (property is string)
            const propName = expr.left.type === 'ThisPropertyAccess'
              ? expr.left.property
              : (expr.left.property.name || expr.left.property.value);
            let fieldName = this.toSnakeCase(propName);
            // Remove leading underscore for Rust field names (Rust uses pub(crate) instead)
            if (fieldName.startsWith('_'))
              fieldName = fieldName.substring(1);
            // Skip test vectors - they have mixed types that don't work in Rust
            if (fieldName === 'tests' || fieldName === 'test_vectors') {
              continue;
            }

            let value;
            // If this field was extracted to a local, use the local variable
            if (this.constructorLocals.has(fieldName)) {
              value = new RustIdentifier(fieldName);
            } else {
              value = this.transformExpression(expr.right);
            }

            // If we know the field type and it's a literal, ensure the type suffix is correct
            const expectedType = this.structFieldTypes.get(fieldName);
            if (expectedType && value && value.nodeType === 'Literal' && typeof value.value === 'number') {
              const targetType = expectedType.name;
              // Coerce numeric literals to match expected field type
              if (targetType === 'usize' && value.suffix !== 'usize')
                value = RustLiteral.UInt(value.value, 'usize');
              else if (targetType === 'i32' && value.suffix !== 'i32')
                value = RustLiteral.UInt(value.value, 'i32');
              else if (targetType === 'i64' && value.suffix !== 'i64')
                value = RustLiteral.UInt(value.value, 'i64');
              else if (targetType === 'u8' && value.suffix !== 'u8')
                value = RustLiteral.UInt(value.value, 'u8');
              else if (targetType === 'u16' && value.suffix !== 'u16')
                value = RustLiteral.UInt(value.value, 'u16');
              else if (targetType === 'u64' && value.suffix !== 'u64')
                value = RustLiteral.UInt(value.value, 'u64');
            }

            // Handle Vec field initialization - coerce element types
            // Check various locations for the Vec element type
            let vecElemType = null;
            if (expectedType?.elementType?.name)
              vecElemType = expectedType.elementType.name;
            else if (expectedType?.generic?.name)
              vecElemType = expectedType.generic.name;
            else if (expectedType?.isVec && expectedType?.genericArguments?.[0]?.name)
              vecElemType = expectedType.genericArguments[0].name;

            // Handle both MacroCall (vec!) and VecMacro AST nodes
            const isVecValue = value && ((value.nodeType === 'MacroCall' && value.name === 'vec') ||
                               value.nodeType === 'VecMacro');

            if (vecElemType && isVecValue) {
              const intTypes = ['u8', 'u16', 'u32', 'u64', 'i8', 'i16', 'i32', 'i64', 'usize', 'isize'];
              // Access elements from either .args or .elements
              const elements = value.args || value.elements;
              if (intTypes.includes(vecElemType) && elements) {
                // Coerce all numeric literal elements in the vec to the expected element type
                const newElements = elements.map(arg => {
                  if (arg.nodeType === 'Literal' && typeof arg.value === 'number') {
                    return RustLiteral.UInt(arg.value, vecElemType);
                  }
                  return arg;
                });
                // Update the correct property
                if (value.args) value.args = newElements;
                else if (value.elements) value.elements = newElements;
              }
            }

            fieldInits.push({ name: fieldName, value });
          } else {
            // Transform other statements
            const rustStmt = this.transformStatement(stmt);
            if (rustStmt) {
              if (Array.isArray(rustStmt))
                body.statements.push(...rustStmt);
              else
                body.statements.push(rustStmt);
            }
          }
        }
      }

      // Clear constructor locals
      this.constructorLocals = null;

      // Add initializers for additional fields discovered from methods
      for (const field of additionalFields) {
        let value;
        // Option types get None, Vec types get vec![]
        if (field.type?.name === 'Option')
          value = new RustIdentifier('None');
        else if (field.type?.name === 'Vec')
          value = new RustMacroCall('vec', []);
        else
          value = new RustIdentifier('None');
        fieldInits.push({ name: field.name, value });
      }

      // Create Self { field: value, ... } struct literal as return expression
      const structLiteral = new RustStructLiteral('Self', fieldInits);
      body.statements.push(new RustReturn(structLiteral));

      ctor.body = body;

      // Restore constructor flag
      this.inConstructor = wasInConstructor;

      return ctor;
    }

    /**
     * Find accesses to this.field.property patterns in an expression
     * Marks the 'field' as needing extraction to a local variable
     */
    findThisFieldAccesses(node, fieldAssignmentOrder) {
      if (!node || typeof node !== 'object') return;

      // Check for MemberExpression with ThisPropertyAccess as object
      // Pattern: this.config.description -> MemberExpression(ThisPropertyAccess(config), description)
      if (node.type === 'MemberExpression' &&
          node.object?.type === 'ThisPropertyAccess') {
        const fieldName = this.toSnakeCase(node.object.property);
        const cleanName = fieldName.startsWith('_') ? fieldName.substring(1) : fieldName;
        // Check if this field was already assigned
        const alreadyAssigned = fieldAssignmentOrder.some(f => f.fieldName === cleanName);
        if (alreadyAssigned) {
          this.constructorLocals.set(cleanName, true);
        }
      }

      // Check for MemberExpression with MemberExpression(ThisExpression) as object
      // Pattern: this.config.description (traditional JS AST)
      if (node.type === 'MemberExpression' &&
          node.object?.type === 'MemberExpression' &&
          node.object?.object?.type === 'ThisExpression') {
        const fieldName = this.toSnakeCase(node.object.property?.name || node.object.property);
        const cleanName = fieldName.startsWith('_') ? fieldName.substring(1) : fieldName;
        const alreadyAssigned = fieldAssignmentOrder.some(f => f.fieldName === cleanName);
        if (alreadyAssigned) {
          this.constructorLocals.set(cleanName, true);
        }
      }

      // Recurse into child nodes
      for (const key in node) {
        if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          for (const child of value) {
            this.findThisFieldAccesses(child, fieldAssignmentOrder);
          }
        } else if (value && typeof value === 'object') {
          this.findThisFieldAccesses(value, fieldAssignmentOrder);
        }
      }
    }

    /**
     * Check if a method body accesses 'this' at all (needs &self or &mut self)
     * Methods that don't access this can be associated functions
     */
    methodAccessesThis(bodyNode) {
      if (!bodyNode) return false;

      const check = (node) => {
        if (!node || typeof node !== 'object') return false;

        // Check for any this access
        if (node.type === 'ThisExpression' ||
            node.type === 'ThisPropertyAccess' ||
            node.type === 'ThisMethodCall') {
          return true;
        }

        // Check MemberExpression with this
        if (node.type === 'MemberExpression' &&
            node.object?.type === 'ThisExpression') {
          return true;
        }

        // Recursively check all child nodes
        for (const key in node) {
          if (key === 'type') continue;
          const value = node[key];
          if (Array.isArray(value)) {
            if (value.some(check)) return true;
          } else if (value && typeof value === 'object') {
            if (check(value)) return true;
          }
        }
        return false;
      };

      return check(bodyNode);
    }

    /**
     * Collect all method names called via this.method() in a body
     * Adds them to this.methodsCalledViaSelf set
     */
    collectThisMethodCalls(bodyNode) {
      if (!bodyNode) return;

      const collect = (node) => {
        if (!node || typeof node !== 'object') return;

        // Check for ThisMethodCall
        if (node.type === 'ThisMethodCall' && node.method) {
          this.methodsCalledViaSelf.add(node.method);
        }

        // Also check for CallExpression with this.method pattern
        if (node.type === 'CallExpression' &&
            node.callee?.type === 'MemberExpression' &&
            node.callee?.object?.type === 'ThisExpression' &&
            node.callee?.property?.name) {
          this.methodsCalledViaSelf.add(node.callee.property.name);
        }

        // Recursively check all child nodes
        for (const key in node) {
          if (key === 'type') continue;
          const value = node[key];
          if (Array.isArray(value)) {
            value.forEach(collect);
          } else if (value && typeof value === 'object') {
            collect(value);
          }
        }
      };

      collect(bodyNode);
    }

    /**
     * Check if a method body modifies 'this' (needs &mut self)
     */
    methodModifiesThis(bodyNode) {
      if (!bodyNode) return false;

      const check = (node) => {
        if (!node || typeof node !== 'object') return false;

        // Check for this.x = y assignments (IL AST uses ThisPropertyAccess)
        if (node.type === 'AssignmentExpression') {
          // Standard MemberExpression with ThisExpression
          if (node.left?.type === 'MemberExpression' &&
              node.left?.object?.type === 'ThisExpression') {
            return true;
          }
          // IL AST uses ThisPropertyAccess for this.property
          if (node.left?.type === 'ThisPropertyAccess') {
            return true;
          }
        }

        // Check for ArrayAppend/method calls that modify this properties
        if (node.type === 'ArrayAppend' || node.type === 'ArrayPop' ||
            node.type === 'ArrayShift' || node.type === 'ArrayUnshift') {
          // Check if the array is a this.property
          if (node.array?.type === 'ThisPropertyAccess' ||
              (node.array?.type === 'MemberExpression' &&
               node.array?.object?.type === 'ThisExpression')) {
            return true;
          }
        }

        // Check for method calls on this that might mutate (push, extend, etc.)
        if (node.type === 'CallExpression' &&
            node.callee?.type === 'MemberExpression' &&
            node.callee?.object?.type === 'ThisPropertyAccess') {
          const method = node.callee?.property?.name;
          if (['push', 'pop', 'extend', 'clear', 'splice', 'fill'].includes(method)) {
            return true;
          }
        }

        // Recursively check all child nodes
        for (const key in node) {
          if (key === 'type') continue;
          const value = node[key];
          if (Array.isArray(value)) {
            if (value.some(check)) return true;
          } else if (value && typeof value === 'object') {
            if (check(value)) return true;
          }
        }
        return false;
      };

      return check(bodyNode);
    }

    /**
     * Transform a method definition
     */
    transformMethodDefinition(node) {
      const methodName = this.toSafeSnakeCase(node.key.name);
      const method = new RustFunction(methodName);

      // Determine self parameter type
      // If method doesn't access 'this' at all, make it an associated function (no self)
      // UNLESS it's called via this.method() elsewhere in the class
      const accessesThis = this.methodAccessesThis(node.value?.body);
      const isCalledViaSelf = this.methodsCalledViaSelf?.has(node.key.name);
      method.isSelfMethod = !node.static && (accessesThis || isCalledViaSelf);
      if (method.isSelfMethod) {
        // Check if method modifies this -> use &mut self, otherwise &self
        const modifiesThis = this.methodModifiesThis(node.value?.body);
        method.selfParameter = modifiesThis ? '&mut self' : '&self';
      } else {
        method.selfParameter = null;
      }

      // Pre-scan variable declarations to register types before return type inference
      if (node.value && node.value.body) {
        this.preScanVariableDeclarations(node.value.body);
      }

      // Infer return type from body
      method.returnType = RustType.Unit();
      if (node.value && node.value.body) {
        const hasReturn = this.hasReturnWithValue(node.value.body);
        if (hasReturn) {
          const lowerName = methodName.toLowerCase();
          // Methods returning word arrays (Vec<u32>) - check first before encrypt/decrypt
          if (lowerName.includes('words') || lowerName.includes('word_array') ||
              lowerName.includes('key_words')) {
            method.returnType = RustType.Vec(RustType.U32());
          }
          // Special handling for block cipher methods - they return Vec<u8>
          else if (lowerName.includes('encrypt') || lowerName.includes('decrypt') ||
              lowerName === 'result' || lowerName.includes('block') ||
              lowerName.includes('process') || lowerName === 'feed') {
            method.returnType = RustType.Vec(RustType.U8());
          } else {
            // Try to infer return type
            const returnType = this.inferReturnType(node.value.body);
            if (returnType)
              method.returnType = returnType;
          }
        }
      }

      // Parameters
      if (node.value && node.value.params) {
        // Check if method name suggests it works with word arrays
        const lowerMethodName = methodName.toLowerCase();
        const isWordMethod = lowerMethodName.includes('words') || lowerMethodName.includes('word_array');
        // Check if this is an internal helper that might use u32 parameters
        const isInternalHelper = lowerMethodName.startsWith('_') ||
                                  lowerMethodName.includes('calculate') ||
                                  lowerMethodName.includes('mx');

        for (const param of node.value.params) {
          const paramName = this.toSnakeCase(param.name);
          let paramType;

          // For methods working with words, single-letter params are typically Vec<u32>
          if (isWordMethod && param.name.length === 1 && /[a-z]/i.test(param.name)) {
            paramType = RustType.Vec(RustType.U32());
          }
          // For internal helper methods, 'key' is often a single u32 (word from key array)
          // not the full key byte array
          else if (isInternalHelper && param.name.toLowerCase() === 'key') {
            paramType = RustType.U32();
          } else {
            paramType = this.inferTypeFromName(param.name);
          }

          const rustParam = new RustParameter(paramName, paramType);
          method.parameters.push(rustParam);

          this.registerVariableType(param.name, paramType);
        }
      }

      // Body
      if (node.value && node.value.body) {
        // Track return type for Some() wrapping in return statements
        const savedReturnType = this.currentMethodReturnType;
        this.currentMethodReturnType = method.returnType;
        method.body = this.transformBlockStatement(node.value.body);
        this.currentMethodReturnType = savedReturnType;
      }

      return method;
    }

    /**
     * Transform a getter method definition
     * JavaScript: get key() { return this._key; }
     * Rust:       pub fn key(&self) -> Option<Vec<u8>> { self._key.clone() }
     */
    transformGetterMethod(node) {
      const propertyName = this.toSafeSnakeCase(node.key.name);
      const method = new RustFunction(propertyName);

      // Getters always use &self (non-mutating)
      method.isSelfMethod = !node.static;
      method.selfParameter = node.static ? null : '&self';

      // Check if this is an Option field getter (common pattern: return this._x ? [...this._x] : null)
      const lowerName = propertyName.toLowerCase();
      const fieldType = this.structFieldTypes.get(propertyName) || this.structFieldTypes.get('_' + propertyName);
      const isOptionField = (fieldType && fieldType.name === 'Option') ||
        lowerName === 'key' || lowerName.includes('buffer');

      // Return type from annotation or inference
      if (isOptionField) {
        // Option fields should return Option<Vec<u8>> clone
        method.returnType = RustType.Option(RustType.Vec(RustType.U8()));
        // Simplified body: just clone the Option field
        const body = new RustBlock();
        body.statements = [
          new RustReturn(
            new RustMethodCall(
              new RustFieldAccess(new RustIdentifier('self'), propertyName),
              'clone',
              []
            )
          )
        ];
        method.body = body;
      } else if (node.value && node.value.returnType) {
        method.returnType = this.mapType(node.value.returnType);
        if (node.value && node.value.body) {
          const savedReturnType = this.currentMethodReturnType;
          this.currentMethodReturnType = method.returnType;
          method.body = this.transformBlockStatement(node.value.body);
          this.currentMethodReturnType = savedReturnType;
        }
      } else if (node.value && node.value.body) {
        const returnType = this.inferReturnType(node.value.body);
        method.returnType = returnType || RustType.U32();
        const savedReturnType = this.currentMethodReturnType;
        this.currentMethodReturnType = method.returnType;
        method.body = this.transformBlockStatement(node.value.body);
        this.currentMethodReturnType = savedReturnType;
      } else {
        // Infer from property name
        method.returnType = this.inferTypeFromName(node.key.name) || RustType.U32();
      }

      return method;
    }

    /**
     * Transform a setter method definition
     * JavaScript: set key(value) { this._key = value; }
     * Rust:       pub fn set_key(&mut self, value: Option<Vec<u8>>) { self._key = value; }
     */
    transformSetterMethod(node) {
      const propertyName = this.toSafeSnakeCase(node.key?.name || 'value');
      const methodName = 'set_' + propertyName;
      const method = new RustFunction(methodName);

      // Setters always use &mut self (mutating)
      method.isSelfMethod = !node.static;
      method.selfParameter = node.static ? null : '&mut self';

      // Setters return unit type
      method.returnType = RustType.Unit();

      // Parameters (setter has one parameter)
      if (node.value && node.value.params && node.value.params.length > 0) {
        for (const param of node.value.params) {
          const paramName = this.toSnakeCase(param.name);
          let paramType = null;

          if (param.typeAnnotation) {
            paramType = this.mapType(param.typeAnnotation);
          } else {
            // Infer from parameter name or property name
            paramType = this.inferTypeFromName(param.name) ||
                        this.inferTypeFromName(node.key?.name) ||
                        RustType.U32();
          }

          const rustParam = new RustParameter(paramName, paramType);
          method.parameters.push(rustParam);

          this.registerVariableType(param.name, paramType);
        }
      }

      // Body
      if (node.value && node.value.body) {
        method.body = this.transformBlockStatement(node.value.body);
      }

      return method;
    }

    /**
     * Check if body has return statement with value
     */
    hasReturnWithValue(bodyNode) {
      if (!bodyNode) return false;

      const check = (node) => {
        if (!node) return false;
        if (node.type === 'ReturnStatement' && node.argument) return true;

        for (const key in node) {
          if (key === 'type') continue;
          const value = node[key];
          if (Array.isArray(value)) {
            if (value.some(check)) return true;
          } else if (value && typeof value === 'object') {
            if (check(value)) return true;
          }
        }
        return false;
      };

      return check(bodyNode);
    }

    /**
     * Infer return type from return statements
     * Returns { type: RustType, isOption: boolean } to track nullable returns
     */
    inferReturnType(bodyNode) {
      if (!bodyNode) return null;

      const returnTypes = [];
      let hasNullReturn = false;

      const collect = (node) => {
        if (!node) return;
        if (node.type === 'ReturnStatement') {
          if (!node.argument ||
              (node.argument.type === 'Literal' &&
               (node.argument.value === null || node.argument.value === undefined))) {
            // Return null/undefined detected
            hasNullReturn = true;
          } else {
            returnTypes.push(this.inferTypeFromValue(node.argument));
          }
        }

        for (const key in node) {
          if (key === 'type') continue;
          const value = node[key];
          if (Array.isArray(value)) {
            value.forEach(collect);
          } else if (value && typeof value === 'object') {
            collect(value);
          }
        }
      };

      collect(bodyNode);

      if (returnTypes.length === 0 && !hasNullReturn) return null;

      // Find a non-null type to use
      let retType = returnTypes.find(t => t !== null) || RustType.U32();

      // Convert slice types to Vec for return types - you can't return a reference to local data
      if (retType && retType.isSlice) {
        const innerType = retType.genericArguments?.[0] || RustType.U8();
        retType = RustType.Vec(innerType);
      }

      // If any return is null, wrap in Option<T>
      if (hasNullReturn) {
        retType = RustType.Option(retType);
        retType.isOptionReturn = true;  // Mark for return transformation
      }

      return retType;
    }

    /**
     * Pre-scan a method body to register variable types before return type inference.
     * This allows inferTypeFromValue to look up variable types for identifiers.
     */
    preScanVariableDeclarations(bodyNode) {
      if (!bodyNode) return;

      const scan = (node) => {
        if (!node) return;

        if (node.type === 'VariableDeclaration') {
          for (const decl of node.declarations || []) {
            if (decl.id?.type === 'Identifier' && decl.id.name) {
              // Infer type from initializer value
              let varType = null;
              if (decl.init) {
                // First check IL node's resultType
                if (decl.init.resultType) {
                  varType = this.getTypeFromILNode(decl.init);
                }
                // Fallback to value-based inference
                if (!varType) {
                  varType = this.inferTypeFromValue(decl.init);
                }
              }
              // Fallback to name-based inference
              if (!varType) {
                varType = this.inferTypeFromName(decl.id.name);
              }
              // Apply word array type correction: Vec<i32> -> Vec<u32> for crypto word arrays
              if (varType && varType.name === 'Vec' && varType.genericArguments?.[0]) {
                const elemType = varType.genericArguments[0].name;
                const lowerName = decl.id.name.toLowerCase();
                if (lowerName.includes('words') || lowerName.includes('word_array') ||
                    lowerName === 'sbox' || lowerName.includes('sbox') ||
                    lowerName.includes('sum0') || lowerName.includes('sum1')) {
                  if (elemType !== 'u32') {
                    varType = RustType.Vec(RustType.U32());
                  }
                }
              }
              if (varType) {
                this.registerVariableType(decl.id.name, varType);
              }
            }
          }
        }

        // Recurse into child nodes
        for (const key in node) {
          if (key === 'type') continue;
          const value = node[key];
          if (Array.isArray(value)) {
            value.forEach(scan);
          } else if (value && typeof value === 'object') {
            scan(value);
          }
        }
      };

      scan(bodyNode);
    }

    /**
     * Transform a property definition
     */
    transformPropertyDefinition(node) {
      const fieldName = this.toSnakeCase(node.key.name);
      let fieldType = RustType.U32();

      if (node.value) {
        fieldType = this.inferTypeFromValue(node.value);
      }

      const field = new RustStructField(fieldName, fieldType);
      this.structFieldTypes.set(fieldName, fieldType);

      return field;
    }

    transformStaticBlock(node) {
      // ES2022 static block -> Rust module-level statements or lazy_static
      // Rust doesn't have static class blocks, so transform to statements
      // Handle both array body and object with body property
      const statements = Array.isArray(node.body) ? node.body :
                         (node.body?.body && Array.isArray(node.body.body)) ? node.body.body : [];
      return statements.map(stmt => this.transformStatement(stmt));
    }

    transformClassExpression(node) {
      // ClassExpression -> Rust struct with impl block
      const structName = node.id?.name || 'AnonymousStruct';
      const structDecl = new RustStruct(structName);

      if (node.body?.body) {
        for (const member of node.body.body) {
          if (member.type === 'PropertyDefinition') {
            const field = new RustField(
              this.toSnakeCase(member.key.name),
              this.inferRustType(member.value)
            );
            structDecl.fields.push(field);
          }
        }
      }

      return structDecl;
    }

    transformYieldExpression(node) {
      // Rust doesn't have yield directly - use Iterator pattern
      // For async, would need async-stream crate
      const argument = node.argument ? this.transformExpression(node.argument) : new RustIdentifier('()');
      return argument; // Return the value directly for now
    }

    /**
     * Transform a block statement
     */
    transformBlockStatement(node) {
      const block = new RustBlock();

      if (node.body && Array.isArray(node.body)) {
        for (let i = 0; i < node.body.length; i++) {
          const stmt = node.body[i];
          const isLast = i === node.body.length - 1;

          const rustStmt = this.transformStatement(stmt);
          if (rustStmt) {
            if (Array.isArray(rustStmt)) {
              block.statements.push(...rustStmt);
            } else {
              block.statements.push(rustStmt);
            }
          }

          // Check if last statement is a return-like expression
          if (isLast && stmt.type === 'ReturnStatement' && stmt.argument) {
            block.hasTrailingExpression = true;
          }
        }
      }

      return block;
    }

    /**
     * Transform a statement
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
          return new RustBreak();

        case 'ContinueStatement':
          return new RustContinue();

        default:
          return null;
      }
    }

    /**
     * Transform a do-while statement to Rust loop with break
     */
    transformDoWhileStatement(node) {
      // Rust doesn't have do-while, use loop { ... if !condition { break; } }
      const body = this.transformStatement(node.body) || new RustBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      // Add condition check at end
      const condition = this.transformExpression(node.test);
      const negatedCondition = new RustUnaryExpression('!', condition);
      const breakIf = new RustIf(negatedCondition, new RustBlock([new RustBreak()]), null);
      bodyBlock.statements.push(breakIf);

      return new RustLoop(bodyBlock);
    }

    /**
     * Transform a switch statement to Rust match expression
     */
    transformSwitchStatement(node) {
      const discriminant = this.transformExpression(node.discriminant);
      const match = new RustMatch(discriminant);

      for (const caseNode of node.cases) {
        const pattern = caseNode.test ? this.transformExpression(caseNode.test) : new RustIdentifier('_');
        const armBody = new RustBlock();

        // Transform case body
        for (const stmt of caseNode.consequent) {
          const rustStmt = this.transformStatement(stmt);
          if (rustStmt) {
            if (Array.isArray(rustStmt)) {
              armBody.statements.push(...rustStmt);
            } else {
              armBody.statements.push(rustStmt);
            }
          }
        }

        const arm = new RustMatchArm(pattern, armBody);
        match.arms.push(arm);
      }

      return match;
    }

    /**
     * Transform a try-catch statement
     */
    transformTryStatement(node) {
      // Rust uses Result<T, E> pattern, not try-catch
      // For simplicity, wrap in a closure that returns Result
      const tryBlock = this.transformStatement(node.block);

      if (node.handler) {
        // Add comment explaining Rust error handling
        const comment = new RustDocComment('Error handling: Rust uses Result<T, E> instead of try-catch', true);
        return comment;
      }

      return tryBlock;
    }

    /**
     * Transform a throw statement
     * JavaScript: throw new Error("message") -> Rust: panic!("message")
     */
    transformThrowStatement(node) {
      // Handle throw new Error("message") specially
      if (node.argument?.type === 'NewExpression') {
        const callee = node.argument.callee;
        const calleeName = callee?.name || callee?.property?.name;
        if (calleeName === 'Error' || calleeName === 'TypeError' || calleeName === 'RangeError') {
          // Extract error message from first argument
          const msgArg = node.argument.arguments?.[0];
          if (msgArg) {
            if (msgArg.type === 'Literal' || msgArg.type === 'StringLiteral') {
              return new RustMacroCall('panic!', new RustLiteral(String(msgArg.value), 'str'));
            }
            if (msgArg.type === 'TemplateLiteral') {
              // Handle template literals - convert to format string
              const parts = [];
              for (let i = 0; i < msgArg.quasis.length; ++i) {
                parts.push(msgArg.quasis[i].value.cooked || msgArg.quasis[i].value.raw);
                if (i < msgArg.expressions.length) {
                  parts.push('{}');
                }
              }
              const formatStr = parts.join('');
              const formatArgs = msgArg.expressions.map(e => this.transformExpression(e));
              return new RustMacroCall('panic!', [new RustLiteral(formatStr, 'str'), ...formatArgs]);
            }
            // Other expression - transform it
            const msgExpr = this.transformExpression(msgArg);
            if (msgExpr) {
              return new RustMacroCall('panic!', [new RustLiteral("{}", 'str'), msgExpr]);
            }
          }
          return new RustMacroCall('panic!', new RustLiteral("Error", 'str'));
        }
      }

      // Generic throw expression
      const expr = node.argument ? this.transformExpression(node.argument) : null;
      if (!expr) {
        return new RustMacroCall('panic!', new RustLiteral("error", 'str'));
      }
      return new RustMacroCall('panic!', [new RustLiteral("{:?}", 'str'), expr]);
    }

    /**
     * Transform a let statement
     */
    transformLetStatement(node) {
      const statements = [];

      for (const decl of node.declarations) {
        // Handle array destructuring: const [a, b, c] = arr;
        if (decl.id.type === 'ArrayPattern') {
          const sourceExpr = decl.init ? this.transformExpression(decl.init) : null;
          if (sourceExpr) {
            for (let i = 0; i < decl.id.elements.length; ++i) {
              const elem = decl.id.elements[i];
              if (!elem) continue; // Skip holes in destructuring

              const varName = this.toSnakeCase(elem.name);
              const indexExpr = new RustIndexExpression(sourceExpr, RustLiteral.UInt(i, 'usize'));
              const letStmt = new RustLet(varName, new RustType('_'), indexExpr);
              letStmt.isMutable = node.kind !== 'const';
              this.registerVariableType(elem.name, new RustType('_'));
              statements.push(letStmt);
            }
          }
          continue;
        }

        const varName = this.toSnakeCase(decl.id.name);
        let varType = null;
        let initializer = null;

        if (decl.init) {
          initializer = this.transformExpression(decl.init);
          varType = this.inferTypeFromValue(decl.init);

          // If value-based inference returned a simple integer type, check if name suggests different type
          // This helps with loop counters like 'i', 'n' which should be usize for array indexing
          // and crypto vars like 'sum', 'j' which should be u32 not i32
          // BUT don't override when the initializer is a method call or array access (trust return/element type)
          const isMethodCall = decl.init.type === 'CallExpression' ||
                               decl.init.type === 'ThisMethodCall' ||
                               (decl.init.type === 'MemberExpression' && decl.init.computed === false);
          const isArrayAccess = decl.init.type === 'MemberExpression' && decl.init.computed === true;
          const isSimpleInt = varType && ['u8', 'u16', 'u32', 'u64', 'i8', 'i16', 'i32', 'i64'].includes(varType.name);
          if (isSimpleInt && !isMethodCall && !isArrayAccess) {
            let nameBasedType = this.inferTypeFromName(decl.id.name);
            // For local variables, convert slice types to Vec (we need owned data)
            if (nameBasedType.isSlice) {
              nameBasedType = RustType.Vec(RustType.U8()); // Convert slice to owned Vec
            }
            // Use name-based type for: usize (loop counters), and u32 when IL says i32 (crypto vars)
            if (nameBasedType.name === 'usize' || nameBasedType.name === 'isize' ||
                (nameBasedType.name === 'u32' && varType.name === 'i32')) {
              const origVarType = varType;
              varType = nameBasedType;
              // Also update the initializer suffix or cast if needed
              if (initializer && initializer.nodeType === 'Literal') {
                initializer = RustLiteral.UInt(initializer.value, nameBasedType.name);
              } else if (initializer && nameBasedType.name !== origVarType.name) {
                // For non-literal expressions, wrap in a cast to the target type
                initializer = new RustCast(initializer, nameBasedType);
              }
            }
          }

          // For Vec types, check if the variable name suggests byte data and override element type
          // This handles cases where IL AST gives Vec<i32> but name is 'output', 'buffer', etc.
          if (varType && varType.name === 'Vec' && varType.genericArguments?.[0]) {
            const elemType = varType.genericArguments[0].name;
            const lowerName = decl.id.name.toLowerCase();
            // Check for word array names first (Vec<u32>)
            if (lowerName.includes('words') || lowerName.includes('word_array') ||
                lowerName === 'sbox' || lowerName.includes('sbox') ||
                lowerName.includes('sum0') || lowerName.includes('sum1')) {
              if (elemType !== 'u32') {
                varType = RustType.Vec(RustType.U32());
              }
            }
            // Then check for byte data names (Vec<u8>)
            else if (elemType !== 'u8') {
              if (lowerName.includes('output') || lowerName.includes('buffer') ||
                  lowerName.includes('block') || lowerName.includes('data') ||
                  lowerName.includes('bytes') || lowerName.includes('input') ||
                  lowerName.includes('result') || lowerName.includes('state')) {
                varType = RustType.Vec(RustType.U8());
              }
            }
          }

          // Coerce literal initializers to match the declared variable type
          if (initializer && initializer.nodeType === 'Literal' && typeof initializer.value === 'number') {
            const targetType = varType.name;
            if (targetType === 'i32' && initializer.suffix !== 'i32')
              initializer = RustLiteral.UInt(initializer.value, 'i32');
            else if (targetType === 'i64' && initializer.suffix !== 'i64')
              initializer = RustLiteral.UInt(initializer.value, 'i64');
            else if (targetType === 'u32' && initializer.suffix !== 'u32')
              initializer = RustLiteral.UInt(initializer.value, 'u32');
            else if (targetType === 'u64' && initializer.suffix !== 'u64')
              initializer = RustLiteral.UInt(initializer.value, 'u64');
            else if (targetType === 'usize' && initializer.suffix !== 'usize')
              initializer = RustLiteral.UInt(initializer.value, 'usize');
          }

          // For loop counters initialized with expressions returning u32, cast to usize
          // e.g., let i = this.cycles - 1 generates self.cycles.wrapping_sub(1u32) which is u32
          // We need to cast to usize for array indexing
          const isBinaryExpr = decl.init.type === 'BinaryExpression';
          if (isMethodCall || isArrayAccess || isBinaryExpr) {
            const lowerName = decl.id.name.toLowerCase();
            const isLoopCounter = lowerName === 'i' || lowerName === 'n' || lowerName === 'idx' ||
                                  lowerName === 'index' || lowerName === 'offset' || lowerName === 'pos' ||
                                  lowerName === 'p' || lowerName === 'j';
            // Check if name-based type is usize but value type is u32
            if (isLoopCounter && (varType.name === 'u32' || varType.name === 'i32')) {
              // Override type to usize and wrap initializer in a cast
              varType = RustType.Usize();
              initializer = new RustCast(initializer, RustType.Usize());
            }
          }
        } else {
          let nameBasedType = this.inferTypeFromName(decl.id.name);
          // For local variables, convert slice types to Vec
          if (nameBasedType.isSlice) {
            nameBasedType = RustType.Vec(RustType.U8());
          }
          varType = nameBasedType;
        }

        const letStmt = new RustLet(varName, varType, initializer);
        // In JavaScript, const arr = [] is valid and allows arr.push()
        // In Rust, we need mut for Vec operations like push/extend
        // Make Vec variables mutable by default since they're typically modified
        const isVecType = varType && (varType.name === 'Vec' || varType.isSlice);
        letStmt.isMutable = node.kind !== 'const' || isVecType;

        this.registerVariableType(decl.id.name, varType);
        statements.push(letStmt);
      }

      return statements;
    }

    /**
     * Transform an expression statement
     */
    transformExpressionStatementNode(node) {
      const expr = this.transformExpression(node.expression);
      if (!expr) return null;

      return new RustExpressionStatement(expr);
    }

    /**
     * Transform a return statement
     */
    transformReturnStatement(node) {
      // Check if current method returns Option<T>
      const isOptionReturn = this.currentMethodReturnType &&
                             this.currentMethodReturnType.name === 'Option';

      if (node.argument) {
        // Check if returning null/undefined
        if (node.argument.type === 'Literal' &&
            (node.argument.value === null || node.argument.value === undefined)) {
          return new RustReturn(new RustIdentifier('None'));
        }

        // Special handling for array literals when return type is Vec<T>
        // Coerce element types to match the declared return type
        if (node.argument.type === 'ArrayExpression' && this.currentMethodReturnType) {
          // Check if array has spread elements - let transformArrayExpression handle those
          const hasSpreadElements = node.argument.elements.some(elem => elem?.type === 'SpreadElement');
          if (hasSpreadElements) {
            // Let transformArrayExpression handle spread elements (concat, etc.)
            const transformed = this.transformExpression(node.argument);
            if (isOptionReturn) {
              return new RustReturn(new RustCall(new RustIdentifier('Some'), [transformed]));
            }
            return new RustReturn(transformed);
          }

          const returnType = this.currentMethodReturnType;
          // Check if returning Vec<T> (directly or inside Option)
          let vecElemType = null;
          if (returnType.name === 'Vec' && returnType.genericArguments?.[0]) {
            vecElemType = returnType.genericArguments[0];
          } else if (returnType.name === 'Option' && returnType.genericArguments?.[0]) {
            const inner = returnType.genericArguments[0];
            if (inner.name === 'Vec' && inner.genericArguments?.[0]) {
              vecElemType = inner.genericArguments[0];
            }
          }

          if (vecElemType) {
            const elemTypeName = typeof vecElemType === 'string' ? vecElemType : vecElemType.name;
            // Transform array elements with correct type suffix
            const elements = node.argument.elements.map(elem => {
              if (elem?.type === 'Literal' && typeof elem.value === 'number') {
                return RustLiteral.UInt(elem.value, elemTypeName);
              }
              // For expressions, cast to the element type if needed
              const transformed = this.transformExpression(elem);
              // Cast non-literals to the target element type (e.g., u32 variable to u8)
              const inferredType = this.inferTypeFromValue(elem);
              const inferredName = inferredType?.name || 'u32';
              if (inferredName !== elemTypeName) {
                // Need to cast to target element type
                const targetType = elemTypeName === 'u8' ? RustType.U8() :
                                   elemTypeName === 'u16' ? RustType.U16() :
                                   elemTypeName === 'u32' ? RustType.U32() :
                                   elemTypeName === 'u64' ? RustType.U64() :
                                   elemTypeName === 'i8' ? RustType.I8() :
                                   elemTypeName === 'i16' ? RustType.I16() :
                                   elemTypeName === 'i32' ? RustType.I32() :
                                   elemTypeName === 'i64' ? RustType.I64() :
                                   new RustType(elemTypeName);
                return new RustCast(transformed, targetType);
              }
              return transformed;
            });
            const vecExpr = new RustVecMacro(elements);

            if (isOptionReturn) {
              return new RustReturn(new RustCall(new RustIdentifier('Some'), [vecExpr]));
            }
            return new RustReturn(vecExpr);
          }
        }

        const expr = this.transformExpression(node.argument);

        // If method returns Option and we're returning a value, wrap in Some()
        if (isOptionReturn) {
          // Don't wrap if already None
          if (expr.nodeType === 'Identifier' && expr.name === 'None')
            return new RustReturn(expr);
          return new RustReturn(new RustCall(new RustIdentifier('Some'), [expr]));
        }
        return new RustReturn(expr);
      }

      // No argument - return None for Option return types, empty return otherwise
      if (isOptionReturn)
        return new RustReturn(new RustIdentifier('None'));
      return new RustReturn();
    }

    /**
     * Transform an if statement
     */
    transformIfStatement(node) {
      const condition = this.transformExpression(node.test);
      const thenBranch = this.transformStatement(node.consequent) || new RustBlock();
      const elseBranch = node.alternate ? this.transformStatement(node.alternate) : null;

      // Ensure branches are blocks
      const thenBlock = thenBranch.nodeType === 'Block' ? thenBranch : this.wrapInBlock(thenBranch);
      const elseBlock = elseBranch ? (elseBranch.nodeType === 'Block' ? elseBranch : this.wrapInBlock(elseBranch)) : null;

      return new RustIf(condition, thenBlock, elseBlock);
    }

    /**
     * Transform a for statement
     */
    transformForStatement(node) {
      // Convert C-style for loop to Rust while loop
      const whileLoop = new RustWhile(
        node.test ? this.transformExpression(node.test) : new RustLiteral(true, 'bool'),
        this.transformStatement(node.body) || new RustBlock()
      );

      // Add init before loop
      const statements = [];
      if (node.init) {
        const initStmt = this.transformStatement(node.init);
        if (initStmt) {
          if (Array.isArray(initStmt)) {
            statements.push(...initStmt);
          } else {
            statements.push(initStmt);
          }
        }
      }

      statements.push(whileLoop);

      // Add update at end of loop body
      if (node.update && whileLoop.body.nodeType === 'Block') {
        const updateStmt = new RustExpressionStatement(this.transformExpression(node.update));
        whileLoop.body.statements.push(updateStmt);
      }

      return statements.length === 1 ? statements[0] : statements;
    }

    /**
     * Transform a while statement
     */
    transformWhileStatement(node) {
      const condition = this.transformExpression(node.test);
      const body = this.transformStatement(node.body) || new RustBlock();

      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new RustWhile(condition, bodyBlock);
    }

    /**
     * Transform a for-of statement: for (const x of array) { ... }
     * Rust equivalent: for x in array.iter() { ... }
     */
    transformForOfStatement(node) {
      // Extract variable name from left side
      let varName = 'item';
      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        if (decl && decl.id) {
          varName = this.toSnakeCase(decl.id.name);
        }
      } else if (node.left.type === 'Identifier') {
        varName = this.toSnakeCase(node.left.name);
      }

      // Transform the iterable - add .iter() for references
      let iterable = this.transformExpression(node.right);

      // Rust for-in loops: for var_name in iterable { body }
      const body = this.transformStatement(node.body) || new RustBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new RustFor(new RustIdentifier(varName), iterable, bodyBlock);
    }

    /**
     * Transform a for-in statement: for (const key in object) { ... }
     * Rust equivalent: for key in object.keys() { ... }
     */
    transformForInStatement(node) {
      // Extract variable name from left side
      let varName = 'key';
      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        if (decl && decl.id) {
          varName = this.toSnakeCase(decl.id.name);
        }
      } else if (node.left.type === 'Identifier') {
        varName = this.toSnakeCase(node.left.name);
      }

      // Transform the object - for-in iterates over keys, so use .keys()
      const object = this.transformExpression(node.right);
      const iterable = new RustMethodCall(object, 'keys', []);

      const body = this.transformStatement(node.body) || new RustBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new RustFor(new RustIdentifier(varName), iterable, bodyBlock);
    }

    /**
     * Wrap a statement in a block
     */
    wrapInBlock(stmt) {
      const block = new RustBlock();
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
     * @param {Object} node - AST node
     * @param {boolean} isLValue - True if this is the left side of an assignment
     */
    transformExpression(node, isLValue = false) {
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
          return this.transformMemberExpression(node, isLValue);

        case 'CallExpression':
          return this.transformCallExpression(node);

        case 'ArrayExpression':
          return this.transformArrayExpression(node);

        case 'ObjectExpression':
          return this.transformObjectExpression(node);

        case 'NewExpression':
          return this.transformNewExpression(node);

        case 'ThisExpression':
          return new RustIdentifier('self');

        case 'ConditionalExpression':
          return this.transformConditionalExpression(node);

        case 'ArrowFunctionExpression':
        case 'FunctionExpression':
          return this.transformFunctionExpression(node);

        case 'SequenceExpression':
          // Return the last expression in the sequence
          return this.transformExpression(node.expressions[node.expressions.length - 1]);

        case 'SpreadElement':
          // ...array -> array (spread into Vec)
          return this.transformSpreadElement(node);

        case 'Super':
          // super -> self (Rust doesn't have inheritance)
          return new RustIdentifier('self');

        case 'TemplateLiteral':
          // `Hello ${name}!` -> format!("Hello {}!", name)
          return this.transformTemplateLiteral(node);

        case 'ObjectPattern':
          // Object destructuring - Rust supports destructuring with structs
          // Return a comment placeholder
          return new RustIdentifier('/* Object destructuring pattern */');

        case 'StaticBlock':
          return this.transformStaticBlock(node);

        case 'ChainExpression':
          // Optional chaining a?.b - Rust uses Option/Result, transform inner
          return this.transformExpression(node.expression);

        case 'ClassExpression':
          // Anonymous class expression - Rust uses closures/structs
          return this.transformClassExpression(node);

        case 'YieldExpression':
          // yield - Rust has async/iterators
          return this.transformYieldExpression(node);

        case 'PrivateIdentifier':
          // #field -> Rust private (module-level) field
          return new RustIdentifier(this.toSnakeCase(node.name));

        // ============== IL AST Node Types ==============

        case 'ThisPropertyAccess': {
          const propName = this.toSnakeCase(node.property);
          const cleanName = propName.startsWith('_') ? propName.substring(1) : propName;

          // In constructor: check if this field was extracted to a local variable
          if (this.inConstructor && this.constructorLocals?.has(cleanName)) {
            // Use the local variable instead of self.field
            return new RustIdentifier(cleanName);
          }

          // Normal case: this.prop -> self.prop
          return new RustFieldAccess(
            new RustIdentifier('self'),
            cleanName
          );
        }

        case 'ThisMethodCall': {
          // In constructor: this.method(...) -> Self::method(...)
          // Because Rust's new() is an associated function, not a method
          const args = (node.arguments || []).map((arg, idx) => {
            const transformed = this.transformExpression(arg);
            // Auto-add reference for byte array arguments to methods
            // Methods take &[u8] which requires & on Vec<u8> arguments
            let argName = null;
            if (arg.type === 'Identifier') {
              argName = arg.name.toLowerCase();
            } else if (arg.type === 'ThisPropertyAccess') {
              argName = (arg.property || '').toLowerCase();
            }
            if (argName) {
              // Common byte array parameter names
              if (argName.includes('block') || argName.includes('data') ||
                  argName.includes('bytes') || argName.includes('input') ||
                  argName.includes('output') || argName.includes('buffer') ||
                  argName.includes('plaintext') || argName.includes('ciphertext')) {
                return new RustUnaryExpression('&', transformed);
              }
            }
            return transformed;
          });

          if (this.inConstructor) {
            // Use Self::method() for associated functions in constructor
            return new RustCall(
              new RustIdentifier(`Self::${this.toSafeSnakeCase(node.method)}`),
              args
            );
          }

          return new RustMethodCall(
            new RustIdentifier('self'),
            this.toSafeSnakeCase(node.method),
            args
          );
        }

        case 'HexDecode':
        case 'StringToBytes': {
          const arg = this.transformExpression(node.arguments?.[0] || node.value);
          if (node.type === 'HexDecode') {
            // hex::decode(str).unwrap()
            return new RustMethodCall(
              new RustCall(new RustIdentifier('Hex::decode'), [arg]),
              'unwrap',
              []
            );
          }
          // str.as_bytes().to_vec()
          return new RustMethodCall(
            new RustMethodCall(arg, 'as_bytes', []),
            'to_vec',
            []
          );
        }

        case 'PackBytes': {
          // Pack bytes to u32/u64 - use from_be_bytes or from_le_bytes
          const rawArgs = node.arguments || node.bytes || [];
          const bits = node.bits || 32;
          const isBigEndian = node.endian === 'big' || node.bigEndian;
          const rustType = bits === 16 ? 'u16' : bits === 64 ? 'u64' : 'u32';
          const method = isBigEndian ? 'from_be_bytes' : 'from_le_bytes';

          // Check for spread
          const hasSpread = rawArgs.some(a => a.type === 'SpreadElement');
          if (hasSpread) {
            const spreadArg = rawArgs.find(a => a.type === 'SpreadElement');
            const arg = this.transformExpression(spreadArg.argument || spreadArg);
            // u32::from_be_bytes(slice.try_into().unwrap())
            return new RustCall(
              new RustIdentifier(`${rustType}::${method}`),
              [new RustMethodCall(
                new RustMethodCall(arg, 'try_into', []),
                'unwrap',
                []
              )]
            );
          }

          const args = rawArgs.map(a => this.transformExpression(a));
          // u32::from_be_bytes([b0, b1, b2, b3])
          return new RustCall(
            new RustIdentifier(`${rustType}::${method}`),
            [new RustArrayLiteral(args)]
          );
        }

        case 'UnpackBytes': {
          // Unpack u32/u64 to bytes - use to_be_bytes or to_le_bytes
          const arg = this.transformExpression(node.arguments?.[0] || node.value);
          const isBigEndian = node.endian === 'big' || node.bigEndian;
          const method = isBigEndian ? 'to_be_bytes' : 'to_le_bytes';
          // value.to_be_bytes().to_vec()
          return new RustMethodCall(
            new RustMethodCall(arg, method, []),
            'to_vec',
            []
          );
        }

        case 'ArrayLength': {
          // array.length -> array.len()
          const arr = this.transformExpression(node.array || node.argument);
          return new RustMethodCall(arr, 'len', []);
        }

        case 'ArraySlice': {
          // array.slice(start, end) -> array[start..end].to_vec()
          const arr = this.transformExpression(node.array);
          const start = node.start ? this.transformExpression(node.start) : new RustLiteral(0, 'int');
          const end = node.end ? this.transformExpression(node.end) : null;
          // Use RustIndex with RustRange for arr[start..end], then .to_vec() for owned Vec
          return new RustMethodCall(
            new RustIndex(arr, new RustRange(start, end)),
            'to_vec',
            []
          );
        }

        case 'Min': {
          // Math.min(a, b, c) -> a.min(b).min(c)
          // Need to ensure type compatibility between arguments
          const nodeArgs = node.arguments || [];
          const args = nodeArgs.map(a => this.transformExpression(a));
          if (args.length === 0) return RustLiteral.UInt(0, 'usize');
          if (args.length === 1) return args[0];
          // Check if first arg is array length (usize) - coerce other args to usize
          const firstArgIsLen = nodeArgs[0]?.type === 'ArrayLength' ||
            nodeArgs[0]?.resultType === 'usize';
          let result = args[0];
          for (let i = 1; i < args.length; ++i) {
            let arg = args[i];
            if (firstArgIsLen && nodeArgs[i]?.type === 'Literal') {
              // Coerce literal to usize for comparison with array length
              arg = RustLiteral.UInt(nodeArgs[i].value, 'usize');
            }
            result = new RustMethodCall(result, 'min', [arg]);
          }
          return result;
        }

        case 'Max': {
          // Math.max(a, b, c) -> a.max(b).max(c)
          // Need to ensure type compatibility between arguments
          const nodeArgs = node.arguments || [];
          const args = nodeArgs.map(a => this.transformExpression(a));
          if (args.length === 0) return RustLiteral.UInt(0, 'usize');
          if (args.length === 1) return args[0];
          // Check if first arg is array length (usize) - coerce other args to usize
          const firstArgIsLen = nodeArgs[0]?.type === 'ArrayLength' ||
            nodeArgs[0]?.resultType === 'usize';
          let result = args[0];
          for (let i = 1; i < args.length; ++i) {
            let arg = args[i];
            if (firstArgIsLen && nodeArgs[i]?.type === 'Literal') {
              // Coerce literal to usize for comparison with array length
              arg = RustLiteral.UInt(nodeArgs[i].value, 'usize');
            }
            result = new RustMethodCall(result, 'max', [arg]);
          }
          return result;
        }

        case 'ArrayCreation': {
          // new Array(size) -> vec![0u32; size]
          // Infer element type from context if available
          let elemType = 'u32';
          if (node.elementType) {
            switch (node.elementType) {
              case 'u8': case 'byte': elemType = 'u8'; break;
              case 'u16': elemType = 'u16'; break;
              case 'u64': elemType = 'u64'; break;
              default: elemType = 'u32'; break;
            }
          }
          let size = node.size ? this.transformExpression(node.size) : new RustLiteral(0, 'usize');
          // Ensure size is usize (vec! repeat size must be usize)
          size = this.coerceToUsize(size);
          return new RustMacroCall('vec', [new RustLiteral(0, elemType), size], '; ');
        }

        case 'RotateLeft':
        case 'RotateRight': {
          // value.rotate_left(n) or value.rotate_right(n)
          const value = this.transformExpression(node.value || node.arguments?.[0]);
          const amount = this.transformExpression(node.amount || node.arguments?.[1]);
          const method = node.type === 'RotateLeft' ? 'rotate_left' : 'rotate_right';
          return new RustMethodCall(value, method, [amount]);
        }

        case 'OpCodesCall': {
          // OpCodes.XYZ(...) - map to Rust operations
          const method = node.method || node.callee?.property?.name;
          const args = (node.arguments || []).map(a => this.transformExpression(a));

          // Map OpCodes methods
          if (method === 'RotL32' || method === 'RotL64' || method === 'RotL16') {
            return new RustMethodCall(args[0], 'rotate_left', [args[1]]);
          }
          if (method === 'RotR32' || method === 'RotR64' || method === 'RotR16') {
            return new RustMethodCall(args[0], 'rotate_right', [args[1]]);
          }
          if (method === 'Hex8ToBytes') {
            return new RustMethodCall(
              new RustCall(new RustIdentifier('Hex::decode'), args),
              'unwrap',
              []
            );
          }
          // CopyArray/CloneArray -> .clone() or .to_vec()
          if (method === 'CopyArray' || method === 'CloneArray') {
            if (args.length >= 1) {
              // For Vec types, .clone() creates a deep copy
              return new RustMethodCall(args[0], 'clone', []);
            }
          }
          // Default: call as function
          return new RustCall(new RustIdentifier(this.toSnakeCase(method)), args);
        }

        case 'Floor': {
          // Math.floor(x) -> for integer division, just return the value (Rust's / truncates)
          // For floats, use x.floor()
          const argNode = node.argument || node.arguments?.[0];
          const argType = this.inferTypeFromValue(argNode);
          const arg = this.transformExpression(argNode);

          // If the argument is a binary division on integers, Rust already truncates
          if (argNode?.type === 'BinaryExpression' && argNode.operator === '/') {
            // Check if operands are integer types - if so, just return the arg
            const leftType = this.inferTypeFromValue(argNode.left);
            const rightType = this.inferTypeFromValue(argNode.right);
            const isIntDiv = ['u32', 'i32', 'usize', 'isize', 'u64', 'i64', 'u8', 'i8', 'u16', 'i16']
              .some(t => leftType?.name === t || rightType?.name === t);
            if (isIntDiv) {
              return arg; // Rust integer division already truncates
            }
          }

          // For integer types, floor is not needed
          if (argType && ['u32', 'i32', 'usize', 'isize', 'u64', 'i64', 'u8', 'i8', 'u16', 'i16'].includes(argType.name)) {
            return arg;
          }

          // For floats or unknown types, use .floor()
          return new RustMethodCall(arg, 'floor', []);
        }

        case 'ArrayFill': {
          // Create filled array -> vec![value; size]
          let size = node.size ? this.transformExpression(node.size) : new RustLiteral(0, 'usize');
          // Ensure size is usize (vec! repeat size must be usize)
          size = this.coerceToUsize(size);
          const value = node.value ? this.transformExpression(node.value) : new RustLiteral(0, 'u32');
          return new RustMacroCall('vec', [value, size], '; ');
        }

        case 'ArrayAppend': {
          // arr.push(val) or arr.push(...spread) -> arr.push(val) or arr.extend(spread)
          const array = this.transformExpression(node.array);
          const value = node.value;
          if (value?.type === 'SpreadElement') {
            // arr.push(...spread) -> arr.extend(spread)
            const spreadArg = this.transformExpression(value.argument);
            return new RustMethodCall(array, 'extend', [spreadArg]);
          }
          // Regular push: arr.push(x)
          let pushArg = this.transformExpression(value);

          // Get array element type - check IL resultType first, then look up field type, then local variable
          // BUT: if IL says int32 (default) but value is uint32, use uint32 instead
          let elemType = null;
          const arrayType = node.array?.resultType;
          if (arrayType && typeof arrayType === 'string' && arrayType.endsWith('[]')) {
            elemType = arrayType.slice(0, -2);
            // If IL says int32 (default) but value produces uint32, use uint32
            // This fixes cases where empty arrays get int32 default but are used with uint32 values
            if (elemType === 'int32' && value?.resultType === 'uint32') {
              elemType = 'uint32';
            }
          } else if (node.array?.type === 'ThisPropertyAccess') {
            // Look up field type from our struct field registry
            const fieldName = this.toSnakeCase(node.array.property);
            const fieldType = this.structFieldTypes.get(fieldName);
            if (fieldType && fieldType.name === 'Vec' && fieldType.genericArguments?.[0]) {
              // Get element type - could be a string or an object with .name property
              const elemArg = fieldType.genericArguments[0];
              elemType = typeof elemArg === 'string' ? elemArg : (elemArg?.name || null);
            }
          } else if (node.array?.type === 'Identifier' || node.array?.name) {
            // Look up local variable type - handle both Identifier type and nodes with name property
            const varName = node.array?.name || node.array?.id?.name;
            if (varName) {
              const varType = this.getVariableType(varName);
              if (varType && varType.name === 'Vec' && varType.genericArguments?.[0]) {
                const elemArg = varType.genericArguments[0];
                elemType = typeof elemArg === 'string' ? elemArg : (elemArg?.name || null);
              }
            }
          }

          if (elemType) {
            // Map IL types to Rust types
            const ilToRust = {
              'int32': 'i32', 'int': 'i32', 'number': 'i32',
              'uint32': 'u32', 'uint8': 'u8', 'byte': 'u8',
              'int8': 'i8', 'uint16': 'u16', 'int16': 'i16',
              'int64': 'i64', 'uint64': 'u64',
              // Already Rust types
              'i32': 'i32', 'u32': 'u32', 'u8': 'u8', 'i8': 'i8',
              'u16': 'u16', 'i16': 'i16', 'u64': 'u64', 'i64': 'i64'
            };
            const rustElemType = ilToRust[elemType] || elemType;

            // Check if value is a byte operation (produces u8 in actual Rust output)
            // The byte operation optimization transforms data[i] - 48 to data[i].wrapping_sub(48u8)
            let actualValueType = 'u32'; // default
            if (value?.type === 'BinaryExpression') {
              const op = value.operator;
              const isByteOp = ['-', '+', '&', '|', '^'].includes(op);
              const rightIsSmall = value.right?.type === 'Literal' &&
                typeof value.right.value === 'number' && value.right.value <= 255;
              const leftIsArrayAccess = value.left?.type === 'MemberExpression' && value.left?.computed;
              if (isByteOp && rightIsSmall && leftIsArrayAccess) {
                // Check if left array is byte data
                const leftObjName = (value.left?.object?.name ||
                  value.left?.object?.property || '').toString().toLowerCase();
                if (leftObjName.includes('data') || leftObjName.includes('byte') ||
                    leftObjName.includes('buffer') || leftObjName.includes('input') ||
                    leftObjName.includes('block') || leftObjName.includes('key')) {
                  actualValueType = 'u8';
                }
              }
            }

            // Check if the value type differs from the array element type
            // Use actualValueType from byte operation detection, or fall back to inferTypeFromValue
            let valueTypeName = actualValueType;
            if (actualValueType === 'u32') {
              const inferredType = this.inferTypeFromValue(value);
              valueTypeName = inferredType?.name || 'u32';
            }

            // Special handling: if value is a Cast to i32 but array expects u32,
            // transform the inner expression instead and skip the i32 cast
            if (valueTypeName === 'i32' && rustElemType === 'u32' && value?.type === 'Cast') {
              const innerArg = value.arguments?.[0] || value.argument || value.value;
              if (innerArg) {
                // Transform the inner expression directly, skipping the i32 cast
                pushArg = this.transformExpression(innerArg);
                // If the inner expr returns u32 (like from_le_bytes), no cast needed
                // Otherwise cast to u32
                const innerType = this.inferTypeFromValue(innerArg);
                if (innerType?.name !== 'u32') {
                  pushArg = new RustCast(pushArg, new RustType('u32'));
                }
              }
            } else if (valueTypeName !== rustElemType) {
              pushArg = new RustCast(pushArg, new RustType(rustElemType));
            }
          }
          return new RustMethodCall(array, 'push', [pushArg]);
        }

        case 'ArrayConcat': {
          // arr.concat(other) -> [arr, other].concat()
          const array = this.transformExpression(node.array);
          const others = (node.arrays || []).map(a => this.transformExpression(a));
          // In Rust: [arr1, arr2, ...].concat() creates a new Vec
          return new RustMethodCall(
            new RustArrayLiteral([array, ...others]),
            'concat',
            []
          );
        }

        case 'ArrayMap': {
          // arr.map(callback) -> arr.iter().map(|x| ...).collect()
          const array = this.transformExpression(node.array);
          const callback = node.callback;

          if (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression') {
            // Get parameter name(s)
            const params = (callback.params || []).map(p =>
              typeof p === 'string' ? p : p.name
            );

            // Transform the body
            const body = this.transformExpression(callback.body);
            const closure = new RustClosure(params, body);

            return new RustMethodCall(
              new RustMethodCall(
                new RustMethodCall(array, 'iter', []),
                'map',
                [closure]
              ),
              'collect',
              []
            );
          }

          // If callback is already a function reference
          const callbackExpr = this.transformExpression(callback);
          return new RustMethodCall(
            new RustMethodCall(
              new RustMethodCall(array, 'iter', []),
              'map',
              [callbackExpr]
            ),
            'collect',
            []
          );
        }

        case 'MathCall': {
          // Math.method(args...) -> Rust equivalent
          const method = node.method;
          const args = (node.arguments || []).map(a => this.transformExpression(a));

          switch (method) {
            case 'imul':
              // Math.imul(a, b) -> a.wrapping_mul(b)
              return new RustMethodCall(args[0], 'wrapping_mul', [args[1]]);
            case 'floor':
              return new RustMethodCall(args[0], 'floor', []);
            case 'ceil':
              return new RustMethodCall(args[0], 'ceil', []);
            case 'round':
              return new RustMethodCall(args[0], 'round', []);
            case 'abs':
              return new RustMethodCall(args[0], 'abs', []);
            case 'min':
              if (args.length >= 2) {
                let result = args[0];
                for (let i = 1; i < args.length; ++i)
                  result = new RustMethodCall(result, 'min', [args[i]]);
                return result;
              }
              return args[0];
            case 'max':
              if (args.length >= 2) {
                let result = args[0];
                for (let i = 1; i < args.length; ++i)
                  result = new RustMethodCall(result, 'max', [args[i]]);
                return result;
              }
              return args[0];
            case 'pow':
              return new RustMethodCall(args[0], 'pow', [args[1]]);
            case 'sqrt':
              return new RustMethodCall(args[0], 'sqrt', []);
            case 'log':
              return new RustMethodCall(args[0], 'ln', []);
            case 'log2':
              return new RustMethodCall(args[0], 'log2', []);
            case 'trunc':
              return new RustMethodCall(args[0], 'trunc', []);
            case 'sign':
              return new RustMethodCall(args[0], 'signum', []);
            case 'clz32':
              return new RustMethodCall(args[0], 'leading_zeros', []);
            case 'random':
              return new RustCall(new RustIdentifier('rand::random'), []);
            default:
              // Fallback: call as method on first arg
              return new RustMethodCall(args[0], this.toSnakeCase(method), args.slice(1));
          }
        }

        case 'ParentConstructorCall':
          // super() - Rust doesn't have inheritance, return comment
          return new RustIdentifier('/* parent constructor */');

        case 'Cast': {
          // OpCodes.ToUint32(expr) -> (expr) as u32
          // The IL AST uses Cast with arguments array and targetType
          const arg = node.arguments?.[0] || node.argument || node.value;

          // Map target type to Rust type
          const targetType = node.targetType || 'u32';
          const rustType = TYPE_MAP[targetType] || targetType;

          // Check if this is an unnecessary i32 cast on a u32-producing expression
          // Pack32LE, Pack32BE, from_le_bytes etc. already return u32, casting to i32 is wrong
          if (rustType === 'i32') {
            const innerType = this.inferTypeFromValue(arg);
            if (innerType?.name === 'u32') {
              // Skip the i32 cast entirely - the expression already produces the correct type
              return this.transformExpression(arg);
            }
          }

          const innerExpr = this.transformExpression(arg);
          if (!innerExpr) return null;

          // Use wrapping operations for integer overflow protection
          // In Rust, (expr) as u32 handles wrapping automatically
          return new RustCast(innerExpr, new RustType(rustType));
        }

        case 'InlinedOpCode':
          // These are already binary expressions with << >> ^ & | etc.
          // Just transform as binary expression
          return this.transformBinaryExpression(node);

        case 'BitwiseOp': {
          // Bitwise operations: XOR, AND, OR, NOT
          const left = this.transformExpression(node.left || node.arguments?.[0]);
          const right = node.right ? this.transformExpression(node.right) : null;
          const op = node.operator || '^';
          if (!right)
            return new RustUnaryExpression('!', left);
          return new RustBinaryExpression(left, op, right);
        }

        case 'BitRotation': {
          // Bit rotation: rotate_left/rotate_right
          const value = this.transformExpression(node.value || node.arguments?.[0]);
          const amount = this.transformExpression(node.amount || node.arguments?.[1]);
          const method = (node.direction === 'left' || node.rotateLeft) ? 'rotate_left' : 'rotate_right';
          return new RustMethodCall(value, method, [amount]);
        }

        case 'TypeConversion': {
          // Type conversion (similar to Cast)
          const argNode = node.value || node.argument || node.arguments?.[0];
          const targetType = node.targetType || node.toType || 'u32';
          const rustType = TYPE_MAP[targetType] || targetType;

          // Check if this is an unnecessary i32 cast on a u32-producing expression
          // Pack32LE, Pack32BE, from_le_bytes etc. already return u32, casting to i32 is wrong
          if (rustType === 'i32') {
            const innerType = this.inferTypeFromValue(argNode);
            if (innerType?.name === 'u32') {
              // Skip the i32 cast entirely - the expression already produces the correct type
              return this.transformExpression(argNode);
            }
          }

          const arg = this.transformExpression(argNode);
          return new RustCast(arg, new RustType(rustType));
        }

        // IL AST StringInterpolation - `Hello ${name}` -> format!("Hello {}", name)
        case 'StringInterpolation': {
          let format = '';
          const args = [];
          if (node.parts) {
            for (const part of node.parts) {
              if (part.type === 'StringPart' || part.ilNodeType === 'StringPart') {
                format += (part.value || '').replace(/\{/g, '{{').replace(/\}/g, '}}');
              } else if (part.type === 'ExpressionPart' || part.ilNodeType === 'ExpressionPart') {
                format += '{}';
                args.push(this.transformExpression(part.expression));
              }
            }
          }
          return new RustMacroCall('format', [new RustLiteral(format, 'str'), ...args]);
        }

        // IL AST ObjectLiteral - {key: value} -> HashMap or struct
        case 'ObjectLiteral': {
          if (!node.properties || node.properties.length === 0)
            return new RustIdentifier('None');
          // Use HashMap for generic objects
          const pairs = [];
          for (const prop of (node.properties || [])) {
            if (prop.type === 'SpreadElement') continue;
            const key = prop.key?.name || prop.key?.value || prop.key || 'key';
            const value = this.transformExpression(prop.value);
            pairs.push([new RustLiteral(key, 'str'), value]);
          }
          // Return HashMap::from([...])
          return new RustCall(
            new RustFieldAccess(new RustIdentifier('HashMap'), 'from'),
            [new RustArrayLiteral(pairs.map(([k, v]) => new RustTuple([k, v])))]
          );
        }

        // IL AST StringFromCharCodes - String.fromCharCode(65) -> char as char
        case 'StringFromCharCodes': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          if (args.length === 0)
            return new RustMethodCall(new RustIdentifier('String'), 'new', []);
          if (args.length === 1) {
            // Single char: (code as u8 as char).to_string()
            return new RustMethodCall(
              new RustCast(new RustCast(args[0], new RustType('u8')), new RustType('char')),
              'to_string',
              []
            );
          }
          // Multiple: collect from chars
          return new RustMethodCall(
            new RustMethodCall(
              new RustArrayLiteral(args.map(a => new RustCast(new RustCast(a, new RustType('u8')), new RustType('char')))),
              'iter',
              []
            ),
            'collect::<String>',
            []
          );
        }

        // IL AST IsArrayCheck - Array.isArray(x) -> x.is_some() for Option or true for Vec
        case 'IsArrayCheck': {
          const value = this.transformExpression(node.value);
          // Rust doesn't have direct isArray - use !value.is_empty() or value.is_some()
          return new RustUnaryExpression('!', new RustMethodCall(value, 'is_empty', []));
        }

        // IL AST ArrowFunction - (x) => expr -> |x| expr
        case 'ArrowFunction': {
          const params = (node.params || []).map(p => {
            const name = typeof p === 'string' ? p : (p.name || 'arg');
            return new RustIdentifier(name);
          });
          let body;
          if (node.body) {
            if (node.body.type === 'BlockStatement') {
              body = this.transformBlockStatement(node.body);
            } else {
              body = this.transformExpression(node.body);
            }
          } else {
            body = new RustIdentifier('()');
          }
          return new RustClosure(params, body);
        }

        // IL AST TypeOfExpression - typeof x -> type_of for debug
        case 'TypeOfExpression': {
          const value = this.transformExpression(node.value);
          // Rust doesn't have runtime typeof; use std::any::type_name
          return new RustCall(
            new RustFieldAccess(new RustFieldAccess(new RustIdentifier('std'), 'any'), 'type_name_of_val'),
            [new RustReference(value)]
          );
        }

        // IL AST Power - x ** y -> x.pow(y) or x.powf(y)
        case 'Power': {
          const left = this.transformExpression(node.left);
          const right = this.transformExpression(node.right);
          // Use powf for floats, pow for integers
          return new RustMethodCall(new RustCast(left, new RustType('f64')), 'powf', [new RustCast(right, new RustType('f64'))]);
        }

        // IL AST ObjectFreeze - Object.freeze(x) -> just return x (no-op in Rust)
        case 'ObjectFreeze': {
          return this.transformExpression(node.value);
        }

        case 'Ceil':
          return new RustMethodCall(this.transformExpression(node.arguments?.[0] || node.value), 'ceil', []);

        case 'Abs':
          return new RustMethodCall(this.transformExpression(node.arguments?.[0] || node.value), 'abs', []);

        case 'Pow': {
          const base = this.transformExpression(node.base || node.arguments?.[0]);
          const exp = this.transformExpression(node.exponent || node.arguments?.[1]);
          return new RustMethodCall(new RustCast(base, new RustType('f64')), 'powf', [new RustCast(exp, new RustType('f64'))]);
        }

        case 'Round':
          return new RustMethodCall(this.transformExpression(node.arguments?.[0] || node.value), 'round', []);

        case 'Trunc':
          return new RustMethodCall(this.transformExpression(node.arguments?.[0] || node.value), 'trunc', []);

        case 'Sign':
          return new RustMethodCall(this.transformExpression(node.arguments?.[0] || node.value), 'signum', []);

        case 'Sqrt':
          return new RustMethodCall(new RustCast(this.transformExpression(node.arguments?.[0] || node.value), new RustType('f64')), 'sqrt', []);

        case 'Cbrt':
          return new RustMethodCall(new RustCast(this.transformExpression(node.arguments?.[0] || node.value), new RustType('f64')), 'cbrt', []);

        case 'Log':
          return new RustMethodCall(new RustCast(this.transformExpression(node.arguments?.[0] || node.value), new RustType('f64')), 'ln', []);

        case 'Log2':
          return new RustMethodCall(new RustCast(this.transformExpression(node.arguments?.[0] || node.value), new RustType('f64')), 'log2', []);

        case 'Log10':
          return new RustMethodCall(new RustCast(this.transformExpression(node.arguments?.[0] || node.value), new RustType('f64')), 'log10', []);

        case 'Exp':
          return new RustMethodCall(new RustCast(this.transformExpression(node.arguments?.[0] || node.value), new RustType('f64')), 'exp', []);

        case 'Sin':
          return new RustMethodCall(new RustCast(this.transformExpression(node.arguments?.[0] || node.value), new RustType('f64')), 'sin', []);

        case 'Cos':
          return new RustMethodCall(new RustCast(this.transformExpression(node.arguments?.[0] || node.value), new RustType('f64')), 'cos', []);

        case 'Tan':
          return new RustMethodCall(new RustCast(this.transformExpression(node.arguments?.[0] || node.value), new RustType('f64')), 'tan', []);

        case 'Asin':
          return new RustMethodCall(new RustCast(this.transformExpression(node.arguments?.[0] || node.value), new RustType('f64')), 'asin', []);

        case 'Acos':
          return new RustMethodCall(new RustCast(this.transformExpression(node.arguments?.[0] || node.value), new RustType('f64')), 'acos', []);

        case 'Atan':
          return new RustMethodCall(new RustCast(this.transformExpression(node.arguments?.[0] || node.value), new RustType('f64')), 'atan', []);

        case 'Atan2': {
          const y = this.transformExpression(node.arguments?.[0] || node.y);
          const x = this.transformExpression(node.arguments?.[1] || node.x);
          return new RustMethodCall(new RustCast(y, new RustType('f64')), 'atan2', [new RustCast(x, new RustType('f64'))]);
        }

        case 'Sinh':
          return new RustMethodCall(new RustCast(this.transformExpression(node.arguments?.[0] || node.value), new RustType('f64')), 'sinh', []);

        case 'Cosh':
          return new RustMethodCall(new RustCast(this.transformExpression(node.arguments?.[0] || node.value), new RustType('f64')), 'cosh', []);

        case 'Tanh':
          return new RustMethodCall(new RustCast(this.transformExpression(node.arguments?.[0] || node.value), new RustType('f64')), 'tanh', []);

        case 'Hypot': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          if (args.length >= 2)
            return new RustMethodCall(new RustCast(args[0], new RustType('f64')), 'hypot', [new RustCast(args[1], new RustType('f64'))]);
          return new RustMethodCall(new RustCast(args[0], new RustType('f64')), 'abs', []);
        }

        case 'Fround':
          return new RustCast(this.transformExpression(node.arguments?.[0] || node.value), new RustType('f32'));

        case 'MathConstant': {
          switch (node.name) {
            case 'PI': return new RustFieldAccess(new RustFieldAccess(new RustIdentifier('std'), 'f64::consts'), 'PI');
            case 'E': return new RustFieldAccess(new RustFieldAccess(new RustIdentifier('std'), 'f64::consts'), 'E');
            case 'LN2': return new RustFieldAccess(new RustFieldAccess(new RustIdentifier('std'), 'f64::consts'), 'LN_2');
            case 'LN10': return new RustFieldAccess(new RustFieldAccess(new RustIdentifier('std'), 'f64::consts'), 'LN_10');
            case 'LOG2E': return new RustFieldAccess(new RustFieldAccess(new RustIdentifier('std'), 'f64::consts'), 'LOG2_E');
            case 'LOG10E': return new RustFieldAccess(new RustFieldAccess(new RustIdentifier('std'), 'f64::consts'), 'LOG10_E');
            case 'SQRT2': return new RustFieldAccess(new RustFieldAccess(new RustIdentifier('std'), 'f64::consts'), 'SQRT_2');
            case 'SQRT1_2': return new RustFieldAccess(new RustFieldAccess(new RustIdentifier('std'), 'f64::consts'), 'FRAC_1_SQRT_2');
            default: return new RustLiteral(node.value, 'f64');
          }
        }

        case 'NumberConstant': {
          switch (node.name) {
            case 'MAX_SAFE_INTEGER': return new RustIdentifier('i64::MAX');
            case 'MIN_SAFE_INTEGER': return new RustIdentifier('i64::MIN');
            case 'MAX_VALUE': return new RustIdentifier('f64::MAX');
            case 'MIN_VALUE': return new RustIdentifier('f64::MIN');
            case 'POSITIVE_INFINITY': return new RustIdentifier('f64::INFINITY');
            case 'NEGATIVE_INFINITY': return new RustIdentifier('f64::NEG_INFINITY');
            case 'NaN': return new RustIdentifier('f64::NAN');
            case 'EPSILON': return new RustIdentifier('f64::EPSILON');
            default: return new RustLiteral(node.value, 'f64');
          }
        }

        case 'InstanceOfCheck': {
          // Rust doesn't have runtime type checking - emit a comment
          const value = this.transformExpression(node.value);
          return new RustIdentifier(`/* ${value} instanceof check not available in Rust */`);
        }

        // ========================[ Array Operations ]========================

        case 'ArrayClear': {
          // arr.clear() -> vec.clear()
          const arr = this.transformExpression(node.array);
          return new RustMethodCall(arr, 'clear', []);
        }

        case 'ArrayEvery': {
          // arr.every(fn) -> arr.iter().all(|e| ...)
          const arr = this.transformExpression(node.array);
          const callback = node.callback || node.predicate;
          if (callback) {
            if (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression') {
              const params = (callback.params || []).map(p =>
                typeof p === 'string' ? p : p.name
              );
              const body = this.transformExpression(callback.body);
              const closure = new RustClosure(params, body);
              return new RustMethodCall(
                new RustMethodCall(arr, 'iter', []),
                'all',
                [closure]
              );
            }
            const fn = this.transformExpression(callback);
            return new RustMethodCall(
              new RustMethodCall(arr, 'iter', []),
              'all',
              [fn]
            );
          }
          return RustLiteral.Bool(true);
        }

        case 'ArrayFilter': {
          // arr.filter(fn) -> arr.iter().filter(|e| ...).collect()
          const arr = this.transformExpression(node.array);
          const callback = node.callback || node.predicate;
          if (callback) {
            if (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression') {
              const params = (callback.params || []).map(p =>
                typeof p === 'string' ? p : p.name
              );
              const body = this.transformExpression(callback.body);
              const closure = new RustClosure(params, body);
              return new RustMethodCall(
                new RustMethodCall(
                  new RustMethodCall(arr, 'iter', []),
                  'filter',
                  [closure]
                ),
                'collect::<Vec<_>>',
                []
              );
            }
            const fn = this.transformExpression(callback);
            return new RustMethodCall(
              new RustMethodCall(
                new RustMethodCall(arr, 'iter', []),
                'filter',
                [fn]
              ),
              'collect::<Vec<_>>',
              []
            );
          }
          return arr;
        }

        case 'ArrayFind': {
          // arr.find(fn) -> arr.iter().find(|e| ...)
          const arr = this.transformExpression(node.array);
          const callback = node.callback || node.predicate;
          if (callback) {
            if (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression') {
              const params = (callback.params || []).map(p =>
                typeof p === 'string' ? p : p.name
              );
              const body = this.transformExpression(callback.body);
              const closure = new RustClosure(params, body);
              return new RustMethodCall(
                new RustMethodCall(arr, 'iter', []),
                'find',
                [closure]
              );
            }
            const fn = this.transformExpression(callback);
            return new RustMethodCall(
              new RustMethodCall(arr, 'iter', []),
              'find',
              [fn]
            );
          }
          return new RustIdentifier('None');
        }

        case 'ArrayFindIndex': {
          // arr.findIndex(fn) -> arr.iter().position(|e| ...)
          const arr = this.transformExpression(node.array);
          const callback = node.callback || node.predicate;
          if (callback) {
            if (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression') {
              const params = (callback.params || []).map(p =>
                typeof p === 'string' ? p : p.name
              );
              const body = this.transformExpression(callback.body);
              const closure = new RustClosure(params, body);
              return new RustMethodCall(
                new RustMethodCall(arr, 'iter', []),
                'position',
                [closure]
              );
            }
            const fn = this.transformExpression(callback);
            return new RustMethodCall(
              new RustMethodCall(arr, 'iter', []),
              'position',
              [fn]
            );
          }
          return new RustIdentifier('None');
        }

        case 'ArrayForEach': {
          // arr.forEach(fn) -> for item in arr.iter() { ... }
          // In expression context, return a comment since forEach is a statement
          const arr = this.transformExpression(node.array);
          const callback = node.callback || node.fn;
          if (callback) {
            if (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression') {
              const params = (callback.params || []).map(p =>
                typeof p === 'string' ? p : p.name
              );
              const body = this.transformExpression(callback.body);
              const closure = new RustClosure(params, body);
              return new RustMethodCall(
                new RustMethodCall(arr, 'iter', []),
                'for_each',
                [closure]
              );
            }
            const fn = this.transformExpression(callback);
            return new RustMethodCall(
              new RustMethodCall(arr, 'iter', []),
              'for_each',
              [fn]
            );
          }
          return new RustIdentifier('/* forEach requires callback */');
        }

        case 'ArrayFrom': {
          // Array.from(x) -> x.to_vec() or Vec::from(x)
          const iterable = this.transformExpression(node.iterable || node.arrayLike);
          if (node.mapFunction || node.mapFn) {
            // Array.from(arr, fn) -> arr.iter().map(fn).collect()
            const mapFn = this.transformExpression(node.mapFunction || node.mapFn);
            return new RustMethodCall(
              new RustMethodCall(
                new RustMethodCall(iterable, 'iter', []),
                'map',
                [mapFn]
              ),
              'collect::<Vec<_>>',
              []
            );
          }
          return new RustMethodCall(iterable, 'to_vec', []);
        }

        case 'ArrayIncludes': {
          // arr.includes(element) -> arr.contains(&element)
          const arr = this.transformExpression(node.array);
          const element = this.transformExpression(node.value || node.element);
          return new RustMethodCall(arr, 'contains', [new RustReference(element)]);
        }

        case 'ArrayIndexOf': {
          // arr.indexOf(element) -> arr.iter().position(|e| *e == element)
          const arr = this.transformExpression(node.array);
          const element = this.transformExpression(node.value || node.element);
          const closure = new RustClosure(
            ['e'],
            new RustBinaryExpression(new RustDereference(new RustIdentifier('e')), '==', element)
          );
          return new RustMethodCall(
            new RustMethodCall(arr, 'iter', []),
            'position',
            [closure]
          );
        }

        case 'ArrayJoin': {
          // arr.join(sep) -> arr.join(sep) for strings, or custom for bytes
          const arr = this.transformExpression(node.array);
          const sep = node.separator ? this.transformExpression(node.separator) : RustLiteral.String('');
          return new RustMethodCall(arr, 'join', [sep]);
        }

        case 'ArrayPop': {
          // arr.pop() -> vec.pop()
          const arr = this.transformExpression(node.array);
          return new RustMethodCall(arr, 'pop', []);
        }

        case 'ArrayReduce': {
          // arr.reduce(fn, init) -> arr.iter().fold(init, |acc, e| ...)
          const arr = this.transformExpression(node.array);
          const initial = node.initial ? this.transformExpression(node.initial) : new RustLiteral(0, 'u32');
          const callback = node.callback || node.reducer;
          if (callback) {
            if (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression') {
              const params = (callback.params || []).map(p =>
                typeof p === 'string' ? p : p.name
              );
              const body = this.transformExpression(callback.body);
              const closure = new RustClosure(params, body);
              return new RustMethodCall(
                new RustMethodCall(arr, 'iter', []),
                'fold',
                [initial, closure]
              );
            }
            const fn = this.transformExpression(callback);
            return new RustMethodCall(
              new RustMethodCall(arr, 'iter', []),
              'fold',
              [initial, fn]
            );
          }
          return initial;
        }

        case 'ArrayReverse': {
          // arr.reverse() -> arr.iter().rev().collect() for new, or arr.reverse() for in-place
          const arr = this.transformExpression(node.array);
          if (node.inPlace) {
            return new RustMethodCall(arr, 'reverse', []);
          }
          return new RustMethodCall(
            new RustMethodCall(
              new RustMethodCall(arr, 'iter', []),
              'rev',
              []
            ),
            'collect::<Vec<_>>',
            []
          );
        }

        case 'ArrayShift': {
          // arr.shift() -> vec.remove(0)
          const arr = this.transformExpression(node.array);
          return new RustMethodCall(arr, 'remove', [RustLiteral.UInt(0, 'usize')]);
        }

        case 'ArraySome': {
          // arr.some(fn) -> arr.iter().any(|e| ...)
          const arr = this.transformExpression(node.array);
          const callback = node.callback || node.predicate;
          if (callback) {
            if (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression') {
              const params = (callback.params || []).map(p =>
                typeof p === 'string' ? p : p.name
              );
              const body = this.transformExpression(callback.body);
              const closure = new RustClosure(params, body);
              return new RustMethodCall(
                new RustMethodCall(arr, 'iter', []),
                'any',
                [closure]
              );
            }
            const fn = this.transformExpression(callback);
            return new RustMethodCall(
              new RustMethodCall(arr, 'iter', []),
              'any',
              [fn]
            );
          }
          return RustLiteral.Bool(false);
        }

        case 'ArraySort': {
          // arr.sort() -> arr.sort() or arr.sort_unstable()
          const arr = this.transformExpression(node.array);
          if (node.comparator || node.compare) {
            const cmp = this.transformExpression(node.comparator || node.compare);
            return new RustMethodCall(arr, 'sort_by', [cmp]);
          }
          return new RustMethodCall(arr, 'sort', []);
        }

        case 'ArraySplice': {
          // arr.splice(start, deleteCount, ...items)
          // Rust: vec.splice(start..start+deleteCount, items)
          const arr = this.transformExpression(node.array);
          const start = this.transformExpression(node.start);
          const deleteCount = node.deleteCount ? this.transformExpression(node.deleteCount) : new RustLiteral(0, 'usize');
          const items = (node.items || []).map(item => this.transformExpression(item));
          const endExpr = new RustBinaryExpression(start, '+', deleteCount);
          const range = new RustRange(start, endExpr);
          if (items.length > 0) {
            return new RustMethodCall(arr, 'splice', [range, new RustVecMacro(items)]);
          }
          // For remove-only splice, use drain
          return new RustMethodCall(arr, 'drain', [range]);
        }

        case 'ArrayUnshift': {
          // arr.unshift(element) -> vec.insert(0, element)
          const arr = this.transformExpression(node.array);
          const element = this.transformExpression(node.value || node.element);
          return new RustMethodCall(arr, 'insert', [RustLiteral.UInt(0, 'usize'), element]);
        }

        case 'ArrayXor': {
          // XOR two arrays element-wise
          // for i in 0..arr1.len() { arr1[i] ^= arr2[i]; }
          const arr1 = this.transformExpression(node.left || node.array1 || node.arguments?.[0]);
          const arr2 = this.transformExpression(node.right || node.array2 || node.arguments?.[1]);
          return new RustCall(new RustIdentifier('xor_arrays'), [arr1, arr2]);
        }

        case 'ClearArray': {
          // arr.fill(0) or for b in arr.iter_mut() { *b = 0; }
          const arr = this.transformExpression(node.array || node.value || node.arguments?.[0]);
          return new RustMethodCall(arr, 'fill', [new RustLiteral(0, 'u8')]);
        }

        case 'CopyArray': {
          // arr.to_vec() or arr.clone()
          const arr = this.transformExpression(node.array || node.value || node.arguments?.[0]);
          return new RustMethodCall(arr, 'to_vec', []);
        }

        // ========================[ String Operations ]========================

        case 'StringCharAt': {
          // s.charAt(index) -> s.chars().nth(index)
          const str = this.transformExpression(node.string || node.value);
          const index = node.index ? this.transformExpression(node.index) : RustLiteral.UInt(0, 'usize');
          return new RustMethodCall(
            new RustMethodCall(str, 'chars', []),
            'nth',
            [index]
          );
        }

        case 'StringCharCodeAt': {
          // s.charCodeAt(index) -> s.as_bytes()[index] as u32
          const str = this.transformExpression(node.string || node.value);
          const index = node.index ? this.transformExpression(node.index) : RustLiteral.UInt(0, 'usize');
          return new RustCast(
            new RustIndex(
              new RustMethodCall(str, 'as_bytes', []),
              index
            ),
            RustType.U32()
          );
        }

        case 'StringEndsWith': {
          // s.endsWith(suffix) -> s.ends_with(suffix)
          const str = this.transformExpression(node.string || node.value);
          const suffix = this.transformExpression(node.searchValue || node.search || node.suffix);
          return new RustMethodCall(str, 'ends_with', [suffix]);
        }

        case 'StringIncludes': {
          // s.includes(sub) -> s.contains(sub)
          const str = this.transformExpression(node.string || node.value);
          const sub = this.transformExpression(node.searchValue || node.search || node.substring);
          return new RustMethodCall(str, 'contains', [sub]);
        }

        case 'StringIndexOf': {
          // s.indexOf(sub) -> s.find(sub)
          const str = this.transformExpression(node.string || node.value);
          const sub = this.transformExpression(node.search || node.substring || node.searchValue);
          return new RustMethodCall(str, 'find', [sub]);
        }

        case 'StringRepeat': {
          // s.repeat(count) -> s.repeat(count)
          const str = this.transformExpression(node.string || node.value);
          const count = node.count ? this.transformExpression(node.count) : RustLiteral.UInt(1, 'usize');
          return new RustMethodCall(str, 'repeat', [count]);
        }

        case 'StringReplace': {
          // s.replace(old, new) -> s.replace(old, new)
          const str = this.transformExpression(node.string || node.value);
          const search = this.transformExpression(node.search || node.searchValue || node.pattern);
          const replacement = this.transformExpression(node.replacement || node.replaceWith || node.replaceValue);
          return new RustMethodCall(str, 'replace', [search, replacement]);
        }

        case 'StringSplit': {
          // s.split(delim) -> s.split(delim).collect::<Vec<_>>()
          const str = this.transformExpression(node.string || node.value);
          const delim = node.separator ? this.transformExpression(node.separator) : RustLiteral.String('');
          return new RustMethodCall(
            new RustMethodCall(str, 'split', [delim]),
            'collect::<Vec<_>>',
            []
          );
        }

        case 'StringStartsWith': {
          // s.startsWith(prefix) -> s.starts_with(prefix)
          const str = this.transformExpression(node.string || node.value);
          const prefix = this.transformExpression(node.searchValue || node.search || node.prefix);
          return new RustMethodCall(str, 'starts_with', [prefix]);
        }

        case 'StringSubstring': {
          // s.substring(start, end) -> &s[start..end]
          const str = this.transformExpression(node.string || node.value);
          const start = node.start ? this.transformExpression(node.start) : RustLiteral.UInt(0, 'usize');
          const end = node.end ? this.transformExpression(node.end) : null;
          return new RustIndex(str, new RustRange(start, end));
        }

        case 'StringToLowerCase': {
          // s.toLowerCase() -> s.to_lowercase()
          const str = this.transformExpression(node.string || node.value);
          return new RustMethodCall(str, 'to_lowercase', []);
        }

        case 'StringToUpperCase': {
          // s.toUpperCase() -> s.to_uppercase()
          const str = this.transformExpression(node.string || node.value);
          return new RustMethodCall(str, 'to_uppercase', []);
        }

        case 'StringTrim': {
          // s.trim() -> s.trim()
          const str = this.transformExpression(node.string || node.value);
          return new RustMethodCall(str, 'trim', []);
        }

        case 'StringTransform': {
          // String transformation based on operation type
          const str = this.transformExpression(node.string || node.argument);
          const operation = node.operation || node.method;
          switch (operation) {
            case 'toLowerCase':
              return new RustMethodCall(str, 'to_lowercase', []);
            case 'toUpperCase':
              return new RustMethodCall(str, 'to_uppercase', []);
            case 'trim':
              return new RustMethodCall(str, 'trim', []);
            case 'trimStart':
              return new RustMethodCall(str, 'trim_start', []);
            case 'trimEnd':
              return new RustMethodCall(str, 'trim_end', []);
            case 'split': {
              const sep = node.separator ? this.transformExpression(node.separator) : RustLiteral.String('');
              return new RustMethodCall(
                new RustMethodCall(str, 'split', [sep]),
                'collect::<Vec<_>>',
                []
              );
            }
            default:
              return str;
          }
        }

        case 'StringConcat': {
          // s1.concat(s2) -> format!("{}{}", s1, s2)
          const str = this.transformExpression(node.string || node.value);
          const others = (node.args || node.strings || []).map(a => this.transformExpression(a));
          const allParts = [str, ...others];
          const formatStr = allParts.map(() => '{}').join('');
          return new RustMacroCall('format', [new RustLiteral(formatStr, 'str'), ...allParts]);
        }

        // ========================[ Buffer/DataView Operations ]========================

        case 'BufferCreation': {
          // new ArrayBuffer(size) -> vec![0u8; size]
          let size = node.size ? this.transformExpression(node.size) : RustLiteral.UInt(0, 'usize');
          size = this.coerceToUsize(size);
          return new RustMacroCall('vec', [new RustLiteral(0, 'u8'), size], '; ');
        }

        case 'DataViewCreation': {
          // new DataView(buffer) -> buffer (Rust slices serve as views)
          const buffer = this.transformExpression(node.buffer || node.arguments?.[0]);
          return buffer;
        }

        case 'DataViewRead': {
          // dataView.getUint32(offset, littleEndian) -> u32::from_le_bytes(...)
          const view = this.transformExpression(node.view);
          const offset = this.transformExpression(node.offset);
          const bits = node.bits || 32;
          const littleEndian = node.littleEndian;
          const bytes = bits / 8;
          const rustType = bits === 16 ? 'u16' : bits === 64 ? 'u64' : 'u32';
          const method = littleEndian ? 'from_le_bytes' : 'from_be_bytes';
          const endOffset = new RustBinaryExpression(offset, '+', RustLiteral.UInt(bytes, 'usize'));
          const slice = new RustIndex(view, new RustRange(offset, endOffset));
          // type::from_le_bytes(slice.try_into().unwrap())
          return new RustCall(
            new RustIdentifier(`${rustType}::${method}`),
            [new RustMethodCall(
              new RustMethodCall(slice, 'try_into', []),
              'unwrap',
              []
            )]
          );
        }

        case 'DataViewWrite': {
          // dataView.setUint32(offset, value, littleEndian) -> view[offset..].copy_from_slice(&value.to_le_bytes())
          const view = this.transformExpression(node.view);
          const offset = this.transformExpression(node.offset);
          const val = this.transformExpression(node.value);
          const bits = node.bits || 32;
          const littleEndian = node.littleEndian;
          const bytes = bits / 8;
          const method = littleEndian ? 'to_le_bytes' : 'to_be_bytes';
          const endOffset = new RustBinaryExpression(offset, '+', RustLiteral.UInt(bytes, 'usize'));
          const destSlice = new RustIndex(view, new RustRange(offset, endOffset));
          return new RustMethodCall(
            destSlice,
            'copy_from_slice',
            [new RustReference(new RustMethodCall(val, method, []))]
          );
        }

        // ========================[ Map/Set Operations ]========================

        case 'MapCreation': {
          // new Map() -> HashMap::new()
          const args = node.entries ? [this.transformExpression(node.entries)] : [];
          if (args.length > 0) {
            // HashMap::from(entries)
            return new RustCall(
              new RustFieldAccess(new RustIdentifier('HashMap'), 'from'),
              args
            );
          }
          return new RustCall(
            new RustFieldAccess(new RustIdentifier('HashMap'), 'new'),
            []
          );
        }

        case 'MapGet': {
          // map.get(key) -> map.get(&key)
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new RustMethodCall(map, 'get', [new RustReference(key)]);
        }

        case 'MapSet': {
          // map.set(key, value) -> map.insert(key, value)
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          const val = this.transformExpression(node.value);
          return new RustMethodCall(map, 'insert', [key, val]);
        }

        case 'MapHas': {
          // map.has(key) -> map.contains_key(&key)
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new RustMethodCall(map, 'contains_key', [new RustReference(key)]);
        }

        case 'MapDelete': {
          // map.delete(key) -> map.remove(&key)
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new RustMethodCall(map, 'remove', [new RustReference(key)]);
        }

        case 'SetCreation': {
          // new Set() -> HashSet::new()
          const args = node.values ? [this.transformExpression(node.values)] : [];
          if (args.length > 0) {
            return new RustCall(
              new RustFieldAccess(new RustIdentifier('HashSet'), 'from'),
              args
            );
          }
          return new RustCall(
            new RustFieldAccess(new RustIdentifier('HashSet'), 'new'),
            []
          );
        }

        // ========================[ Missing Utility Operations ]========================

        case 'HexEncode': {
          // bytes to hex string -> arr.iter().map(|b| format!("{:02x}", b)).collect::<String>()
          const val = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          const closure = new RustClosure(
            ['b'],
            new RustMacroCall('format', [new RustLiteral('{:02x}', 'str'), new RustIdentifier('b')])
          );
          return new RustMethodCall(
            new RustMethodCall(
              new RustMethodCall(val, 'iter', []),
              'map',
              [closure]
            ),
            'collect::<String>',
            []
          );
        }

        case 'HexDecode': {
          // hex string to bytes -> hex_decode helper
          const val = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          return new RustCall(new RustIdentifier('hex_decode'), [val]);
        }

        case 'TypedArrayCreation': {
          // new Uint32Array(size) -> vec![0u32; size]
          let size = node.size ? this.transformExpression(node.size) : RustLiteral.UInt(0, 'usize');
          size = this.coerceToUsize(size);
          const typeMap = {
            'Uint8Array': 'u8', 'Int8Array': 'i8',
            'Uint16Array': 'u16', 'Int16Array': 'i16',
            'Uint32Array': 'u32', 'Int32Array': 'i32',
            'Float32Array': 'f32', 'Float64Array': 'f64',
            'BigUint64Array': 'u64', 'BigInt64Array': 'i64'
          };
          const elemType = typeMap[node.typedArrayType] || 'u8';
          return new RustMacroCall('vec', [new RustLiteral(0, elemType), size], '; ');
        }

        case 'TypedArraySet': {
          // typedArray.set(source, offset) -> dest[offset..offset+src.len()].copy_from_slice(&src)
          const array = this.transformExpression(node.array);
          const source = this.transformExpression(node.source);
          if (node.offset) {
            const offset = this.transformExpression(node.offset);
            const destSlice = new RustIndex(array, new RustRange(offset, null));
            return new RustMethodCall(destSlice, 'copy_from_slice', [new RustReference(source)]);
          }
          return new RustMethodCall(array, 'copy_from_slice', [new RustReference(source)]);
        }

        case 'TypedArraySubarray': {
          // typedArray.subarray(start, end) -> &arr[start..end] or arr[start..end].to_vec()
          const array = this.transformExpression(node.array);
          const start = node.start ? this.transformExpression(node.start) : null;
          const end = node.end ? this.transformExpression(node.end) : null;
          return new RustMethodCall(
            new RustIndex(array, new RustRange(start, end)),
            'to_vec',
            []
          );
        }

        case 'ObjectKeys': {
          // Object.keys(obj) -> map.keys().collect::<Vec<_>>()
          const obj = this.transformExpression(node.object || node.arguments?.[0]);
          return new RustMethodCall(
            new RustMethodCall(obj, 'keys', []),
            'collect::<Vec<_>>',
            []
          );
        }

        case 'ObjectValues': {
          // Object.values(obj) -> map.values().collect::<Vec<_>>()
          const obj = this.transformExpression(node.object || node.arguments?.[0]);
          return new RustMethodCall(
            new RustMethodCall(obj, 'values', []),
            'collect::<Vec<_>>',
            []
          );
        }

        case 'ObjectEntries': {
          // Object.entries(obj) -> map.iter().collect::<Vec<_>>()
          const obj = this.transformExpression(node.object || node.arguments?.[0]);
          return new RustMethodCall(
            new RustMethodCall(obj, 'iter', []),
            'collect::<Vec<_>>',
            []
          );
        }

        case 'Random': {
          // Math.random() -> rand::random::<f64>()
          return new RustCall(new RustIdentifier('rand::random::<f64>'), []);
        }

        case 'DebugOutput': {
          // console.log() -> eprintln!() or println!()
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
          const method = node.method || 'log';
          const macro = method === 'error' || method === 'warn' ? 'eprintln' : 'println';
          if (args.length === 0)
            return new RustMacroCall(macro, [new RustLiteral('', 'str')]);
          if (args.length === 1)
            return new RustMacroCall(macro, [new RustLiteral('{:?}', 'str'), args[0]]);
          const fmtStr = args.map(() => '{:?}').join(' ');
          return new RustMacroCall(macro, [new RustLiteral(fmtStr, 'str'), ...args]);
        }

        case 'ErrorCreation': {
          // throw new Error(msg) -> format!("Error: {}", msg) or panic!
          const msg = node.message ? this.transformExpression(node.message) : RustLiteral.String('error');
          return new RustMacroCall('format', [new RustLiteral('Error: {}', 'str'), msg]);
        }

        case 'IsFiniteCheck': {
          // Number.isFinite(x) -> value.is_finite()
          const val = this.transformExpression(node.value);
          return new RustMethodCall(val, 'is_finite', []);
        }

        case 'IsNaNCheck': {
          // Number.isNaN(x) -> value.is_nan()
          const val = this.transformExpression(node.value);
          return new RustMethodCall(val, 'is_nan', []);
        }

        case 'IsIntegerCheck': {
          // Number.isInteger(x) -> value.fract() == 0.0
          const val = this.transformExpression(node.value);
          return new RustBinaryExpression(
            new RustMethodCall(val, 'fract', []),
            '==',
            new RustLiteral(0.0, 'f64')
          );
        }

        case 'ParentMethodCall': {
          // super.method() -> Trait method call via explicit type
          // Rust doesn't have direct super calls like OO languages
          const method = node.method || node.name || 'method';
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new RustIdentifier(`/* super.${this.toSnakeCase(method)}() - Rust uses trait method dispatch */`);
        }

        case 'BigIntCast': {
          // BigInt(value) -> value as i128 or use num::BigInt
          const val = this.transformExpression(node.argument || node.value || node.arguments?.[0]);
          const isSigned = node.signed !== false;
          const targetType = isSigned ? 'i128' : 'u128';
          return new RustCast(val, new RustType(targetType));
        }

        default:
          return null;
      }
    }

    /**
     * Transform an identifier
     */
    transformIdentifier(node) {
      let name = node.name;

      // Map JavaScript keywords to Rust equivalents
      if (name === 'undefined') return new RustIdentifier('None');
      if (name === 'null') return new RustIdentifier('None');
      if (name === 'NaN') return new RustIdentifier('f64::NAN');
      if (name === 'Infinity') return new RustIdentifier('f64::INFINITY');

      // Check for Rust reserved keywords that need renaming
      if (this.isRustKeyword(name)) {
        name = name + '_';
      }

      // Preserve UPPER_SNAKE_CASE for constants
      if (/^[A-Z][A-Z0-9_]*$/.test(name)) {
        return new RustIdentifier(name);
      }

      return new RustIdentifier(this.toSnakeCase(name));
    }

    /**
     * Transform a literal
     */
    transformLiteral(node) {
      if (typeof node.value === 'number') {
        if (Number.isInteger(node.value)) {
          const suffix = node.value >= 0 ? 'u32' : 'i32';
          return RustLiteral.UInt(node.value, suffix);
        }
        return new RustLiteral(node.value, 'float');
      }

      if (typeof node.value === 'string') {
        // Single character strings should be char literals in Rust
        if (node.value.length === 1)
          return RustLiteral.Char(node.value);
        return RustLiteral.String(node.value);
      }

      if (typeof node.value === 'boolean') {
        return RustLiteral.Bool(node.value);
      }

      if (node.value === null) {
        return new RustIdentifier('None');
      }
      // Handle undefined - treat same as None in Rust
      if (node.value === undefined) {
        return new RustIdentifier('None');
      }

      return new RustLiteral(node.value, 'unknown');
    }

    /**
     * Coerce a Rust expression to usize type
     * If it's a numeric literal, change its suffix to 'usize'
     * Otherwise, wrap in a cast
     */
    coerceToUsize(expr) {
      if (!expr) return expr;
      // If it's a RustLiteral with numeric type, change suffix to usize
      if (expr.nodeType === 'Literal' && typeof expr.value === 'number') {
        return RustLiteral.UInt(expr.value, 'usize');
      }
      // For other expressions, wrap in cast
      return new RustCast(expr, RustType.Usize());
    }

    /**
     * Transform a binary expression
     */
    transformBinaryExpression(node) {
      // Map operators
      let operator = node.operator;
      if (operator === '===') operator = '==';
      if (operator === '!==') operator = '!=';

      // Handle x.length === 0 -> x.is_empty()  (more idiomatic Rust)
      if ((operator === '==' || operator === '===') &&
          node.left?.type === 'MemberExpression' &&
          node.left?.property?.name === 'length' &&
          node.right?.type === 'Literal' && node.right?.value === 0) {
        const array = this.transformExpression(node.left.object);
        return new RustMethodCall(array, 'is_empty', []);
      }
      // Handle x.length !== 0 -> !x.is_empty()
      if ((operator === '!=' || operator === '!==') &&
          node.left?.type === 'MemberExpression' &&
          node.left?.property?.name === 'length' &&
          node.right?.type === 'Literal' && node.right?.value === 0) {
        const array = this.transformExpression(node.left.object);
        return new RustUnaryExpression('!', new RustMethodCall(array, 'is_empty', []));
      }

      // Handle x.length compared to non-zero numbers - .len() returns usize
      if ((node.left?.type === 'MemberExpression' && node.left?.property?.name === 'length') ||
          (node.left?.type === 'ArrayLength')) {
        let left = this.transformExpression(node.left);
        let right;
        // Convert numeric literal to usize for comparison with .len()
        if (node.right?.type === 'Literal' && typeof node.right.value === 'number') {
          right = RustLiteral.UInt(node.right.value, 'usize');
        } else {
          right = this.transformExpression(node.right);
        }
        return new RustBinaryExpression(left, operator, right);
      }

      // Handle expressions involving .len() in binary operations (like len() % x != 0)
      // Check if left side contains a .length property access
      const containsLengthAccess = (n) => {
        if (!n || typeof n !== 'object') return false;
        if (n.type === 'MemberExpression' && n.property?.name === 'length') return true;
        if (n.type === 'ArrayLength') return true;
        return Object.values(n).some(v => containsLengthAccess(v));
      };

      if (containsLengthAccess(node.left)) {
        let left = this.transformExpression(node.left);
        let right;
        // Convert numeric literal to usize for comparison with .len()-derived values
        if (node.right?.type === 'Literal' && typeof node.right.value === 'number') {
          right = RustLiteral.UInt(node.right.value, 'usize');
        } else {
          right = this.transformExpression(node.right);
        }
        return new RustBinaryExpression(left, operator, right);
      }

      // Handle loop index (usize) compared to struct field (often u32)
      // Pattern: i < self.some_field where i is a loop variable
      // Note: 'j' removed - it's often a crypto accumulator (u32), not just a loop index
      // Note: 'p' added - commonly used as loop counter in XXTEA and similar algorithms
      const isLoopIndex = node.left?.type === 'Identifier' &&
                          ['i', 'k', 'n', 'idx', 'index', 'round', 'p'].includes(node.left.name.toLowerCase());
      const isFieldAccess = node.right?.type === 'ThisPropertyAccess' ||
                            (node.right?.type === 'MemberExpression' &&
                             node.right?.object?.type === 'ThisExpression');
      if (isLoopIndex && isFieldAccess && ['<', '<=', '>', '>=', '==', '!='].includes(operator)) {
        let left = this.transformExpression(node.left);
        let right = this.transformExpression(node.right);
        // Cast field to usize: self.field as usize
        right = new RustCast(right, RustType.Usize());
        return new RustBinaryExpression(left, operator, right);
      }

      // Handle variables with length/size suffix compared to literals
      // Pattern: key_length < 1 or buffer_size > 256 (these are usize in Rust)
      // Also includes common loop index variables which are typically usize
      const isUsizeVariable = (n) => {
        if (n?.type !== 'Identifier') return false;
        const name = n.name?.toLowerCase() || '';
        // Common loop index variable names (typed as usize for array indexing)
        // Note: 'j' removed - it's often a crypto accumulator (u32), not just a loop index
        // Note: 'p' added - commonly used as loop counter in XXTEA and similar algorithms
        const loopVars = ['i', 'k', 'n', 'idx', 'index', 'round', 'offset', 'pos', 'position', 'p'];
        if (loopVars.includes(name)) return true;
        // Length/size suffix patterns
        return name.endsWith('_length') || name.endsWith('length') ||
               name.endsWith('_size') || name.endsWith('size') ||
               name.endsWith('_len') || name.endsWith('len') ||
               name.endsWith('_count') || name.endsWith('count');
      };
      if (isUsizeVariable(node.left) && node.right?.type === 'Literal' &&
          typeof node.right.value === 'number' && ['<', '<=', '>', '>=', '==', '!='].includes(operator)) {
        let left = this.transformExpression(node.left);
        let right = RustLiteral.UInt(node.right.value, 'usize');
        return new RustBinaryExpression(left, operator, right);
      }
      if (isUsizeVariable(node.right) && node.left?.type === 'Literal' &&
          typeof node.left.value === 'number' && ['<', '<=', '>', '>=', '==', '!='].includes(operator)) {
        let left = RustLiteral.UInt(node.left.value, 'usize');
        let right = this.transformExpression(node.right);
        return new RustBinaryExpression(left, operator, right);
      }

      // Check if either side is a usize field access (self.i, self.j, etc.)
      // Excludes computed member expressions like data[i] which are array accesses
      const isUsizeFieldAccess = (n) => {
        if (n?.type !== 'MemberExpression' && n?.type !== 'ThisPropertyAccess') return false;
        // Computed member expressions (data[i]) are array accesses, not field accesses
        if (n?.computed) return false;
        const rawProp = n.property?.name || n.property;
        const propName = typeof rawProp === 'string' ? rawProp.toLowerCase() : '';
        // Note: 'j' removed - it's often a crypto accumulator (u32), not just a loop index
        const usizeFields = ['i', 'index', 'idx', 'offset', 'position', 'pos', 'key_size', 'block_size'];
        return usizeFields.includes(propName);
      };

      // Recursively check if an expression involves usize values
      const involvesUsize = (n) => {
        if (!n) return false;
        if (isUsizeVariable(n) || isUsizeFieldAccess(n)) return true;
        // Nested binary expressions: (i + 1) involves usize if i is usize
        if (n.type === 'BinaryExpression') {
          return involvesUsize(n.left) || involvesUsize(n.right);
        }
        // Floor/Truncate nodes wrap division for integer semantics - check their argument/value
        if (n.type === 'Floor' || n.type === 'Truncate' || n.type === 'Ceil') {
          return involvesUsize(n.argument) || involvesUsize(n.value);
        }
        // Division nodes (when not wrapped in Floor)
        if (n.type === 'Divide' || n.type === 'Division') {
          return involvesUsize(n.left) || involvesUsize(n.right);
        }
        // .len() returns usize
        if (n.type === 'ArrayLength') return true;
        if (n.type === 'MemberExpression' && n.property?.name === 'length') return true;
        return false;
      };

      // Handle arithmetic operations with usize variables/fields and literals
      const arithmeticOps = ['+', '-', '*', '/', '%', '&', '|', '^'];
      if (arithmeticOps.includes(operator)) {
        const leftIsUsize = isUsizeVariable(node.left) || isUsizeFieldAccess(node.left);
        const rightIsUsize = isUsizeVariable(node.right) || isUsizeFieldAccess(node.right);

        if (leftIsUsize && node.right?.type === 'Literal' && typeof node.right.value === 'number') {
          let left = this.transformExpression(node.left);
          let right = RustLiteral.UInt(node.right.value, 'usize');
          return new RustBinaryExpression(left, operator, right);
        }
        if (rightIsUsize && node.left?.type === 'Literal' && typeof node.left.value === 'number') {
          let left = RustLiteral.UInt(node.left.value, 'usize');
          let right = this.transformExpression(node.right);
          return new RustBinaryExpression(left, operator, right);
        }

        // Handle nested expressions: (i + 1) % 2 - left is BinaryExpression that involves usize
        const leftInvolvesUsize = involvesUsize(node.left);
        const rightInvolvesUsize = involvesUsize(node.right);

        if (leftInvolvesUsize && node.right?.type === 'Literal' && typeof node.right.value === 'number') {
          let left = this.transformExpression(node.left);
          let right = RustLiteral.UInt(node.right.value, 'usize');
          return new RustBinaryExpression(left, operator, right);
        }
        if (rightInvolvesUsize && node.left?.type === 'Literal' && typeof node.left.value === 'number') {
          let left = RustLiteral.UInt(node.left.value, 'usize');
          let right = this.transformExpression(node.right);
          return new RustBinaryExpression(left, operator, right);
        }

        // Handle identifier vs identifier with different numeric types for arithmetic
        if (node.left?.type === 'Identifier' && node.right?.type === 'Identifier') {
          const lhsType = this.getVariableType(node.left.name);
          const rhsType = this.getVariableType(node.right.name);
          if (lhsType && rhsType && lhsType.name !== rhsType.name) {
            const isLhsU32 = lhsType.name === 'u32';
            const isRhsU32 = rhsType.name === 'u32';
            const isLhsUsize = lhsType.name === 'usize';
            const isRhsUsize = rhsType.name === 'usize';
            // u32 with usize -> cast u32 to usize
            if (isLhsU32 && isRhsUsize) {
              let left = new RustCast(this.transformExpression(node.left), RustType.Usize());
              let right = this.transformExpression(node.right);
              return new RustBinaryExpression(left, operator, right);
            }
            if (isLhsUsize && isRhsU32) {
              let left = this.transformExpression(node.left);
              let right = new RustCast(this.transformExpression(node.right), RustType.Usize());
              return new RustBinaryExpression(left, operator, right);
            }
          }
        }

        // Handle expressions: when one side is u32-typed and other involves usize
        if (rightInvolvesUsize) {
          const leftType = this.inferTypeFromValue(node.left);
          if (leftType && leftType.name === 'u32') {
            let left = new RustCast(this.transformExpression(node.left), RustType.Usize());
            let right = this.transformExpression(node.right);
            return new RustBinaryExpression(left, operator, right);
          }
        }
        if (leftInvolvesUsize) {
          const rightType = this.inferTypeFromValue(node.right);
          if (rightType && rightType.name === 'u32') {
            let left = this.transformExpression(node.left);
            let right = new RustCast(this.transformExpression(node.right), RustType.Usize());
            return new RustBinaryExpression(left, operator, right);
          }
        }
      }

      // Handle comparison operators with nested usize expressions
      // e.g., (i + 1) % 2 == 1 -> right side 1 should be 1usize
      const comparisonOps = ['==', '!=', '<', '<=', '>', '>='];
      if (comparisonOps.includes(operator)) {
        const leftInvolvesUsize = involvesUsize(node.left);
        const rightInvolvesUsize = involvesUsize(node.right);

        if (leftInvolvesUsize && node.right?.type === 'Literal' && typeof node.right.value === 'number') {
          let left = this.transformExpression(node.left);
          let right = RustLiteral.UInt(node.right.value, 'usize');
          return new RustBinaryExpression(left, operator, right);
        }
        if (rightInvolvesUsize && node.left?.type === 'Literal' && typeof node.left.value === 'number') {
          let left = RustLiteral.UInt(node.left.value, 'usize');
          let right = this.transformExpression(node.right);
          return new RustBinaryExpression(left, operator, right);
        }

        // General type matching: if LHS is a known-typed variable and RHS is a literal, match the type
        if (node.left?.type === 'Identifier' && node.right?.type === 'Literal' && typeof node.right.value === 'number') {
          const lhsType = this.getVariableType(node.left.name);
          if (lhsType) {
            const intTypes = ['u8', 'u16', 'u32', 'u64', 'i8', 'i16', 'i32', 'i64', 'usize', 'isize'];
            if (intTypes.includes(lhsType.name)) {
              let left = this.transformExpression(node.left);
              let right = RustLiteral.UInt(node.right.value, lhsType.name);
              return new RustBinaryExpression(left, operator, right);
            }
          }
        }
        if (node.right?.type === 'Identifier' && node.left?.type === 'Literal' && typeof node.left.value === 'number') {
          const rhsType = this.getVariableType(node.right.name);
          if (rhsType) {
            const intTypes = ['u8', 'u16', 'u32', 'u64', 'i8', 'i16', 'i32', 'i64', 'usize', 'isize'];
            if (intTypes.includes(rhsType.name)) {
              let left = RustLiteral.UInt(node.left.value, rhsType.name);
              let right = this.transformExpression(node.right);
              return new RustBinaryExpression(left, operator, right);
            }
          }
        }

        // Handle identifier vs identifier with different numeric types
        // Cast u32 to usize when comparing with usize variable
        if (node.left?.type === 'Identifier' && node.right?.type === 'Identifier') {
          const lhsType = this.getVariableType(node.left.name);
          const rhsType = this.getVariableType(node.right.name);
          if (lhsType && rhsType && lhsType.name !== rhsType.name) {
            const isLhsU32 = lhsType.name === 'u32';
            const isRhsU32 = rhsType.name === 'u32';
            const isLhsUsize = lhsType.name === 'usize';
            const isRhsUsize = rhsType.name === 'usize';
            // u32 compared with usize -> cast u32 to usize
            if (isLhsU32 && isRhsUsize) {
              let left = new RustCast(this.transformExpression(node.left), RustType.Usize());
              let right = this.transformExpression(node.right);
              return new RustBinaryExpression(left, operator, right);
            }
            if (isLhsUsize && isRhsU32) {
              let left = this.transformExpression(node.left);
              let right = new RustCast(this.transformExpression(node.right), RustType.Usize());
              return new RustBinaryExpression(left, operator, right);
            }
          }
        }

        // Handle expressions: when left is u32-typed and right involves usize
        if (rightInvolvesUsize) {
          const leftType = this.inferTypeFromValue(node.left);
          if (leftType && leftType.name === 'u32') {
            let left = new RustCast(this.transformExpression(node.left), RustType.Usize());
            let right = this.transformExpression(node.right);
            return new RustBinaryExpression(left, operator, right);
          }
        }
        if (leftInvolvesUsize) {
          const rightType = this.inferTypeFromValue(node.right);
          if (rightType && rightType.name === 'u32') {
            let left = this.transformExpression(node.left);
            let right = new RustCast(this.transformExpression(node.right), RustType.Usize());
            return new RustBinaryExpression(left, operator, right);
          }
        }
      }

      // Handle byte operations: data[i] & 0xFF -> data[i] & 255u8
      // Handle byte subtraction: data[i] - 0x30 -> data[i] - 48u8 (for ASCII conversion)
      // When indexing a byte array with a byte mask or small value, use u8 type
      const isByteOperation = ['-', '+', '&', '|', '^'].includes(operator);
      if (isByteOperation && node.right?.type === 'Literal' &&
          typeof node.right.value === 'number' && node.right.value <= 255) {
        // Check if left side is an array index (potential byte access)
        const isArrayIndex = node.left?.type === 'MemberExpression' && node.left?.computed;
        const leftObjName = node.left?.object?.name?.toLowerCase() || '';
        const isDataAccess = leftObjName.includes('data') ||
                             leftObjName.includes('byte') ||
                             leftObjName.includes('block') ||
                             leftObjName.includes('buffer') ||
                             leftObjName.includes('input') ||
                             leftObjName.includes('message') ||
                             leftObjName.includes('key');
        if (isArrayIndex && isDataAccess) {
          let left = this.transformExpression(node.left);
          let right = RustLiteral.UInt(node.right.value, 'u8');
          return new RustBinaryExpression(left, operator, right);
        }
      }

      let left = this.transformExpression(node.left);
      let right = this.transformExpression(node.right);

      // Handle JavaScript >>> 0 idiom (cast to unsigned)
      if (operator === '>>>' && node.right.type === 'Literal' && node.right.value === 0) {
        // In Rust, just cast to u32
        return new RustCast(left, RustType.U32());
      }

      // Unsigned right shift in Rust: value as u32 >> amount
      if (operator === '>>>') {
        // Cast left to u32 for unsigned shift
        left = new RustCast(left, RustType.U32());
        operator = '>>';
      }

      // Handle typeof comparisons
      if ((operator === '==' || operator === '!=') &&
          node.left.type === 'UnaryExpression' && node.left.operator === 'typeof' &&
          node.right.type === 'Literal' && typeof node.right.value === 'string') {
        // In Rust, types are known at compile time - typeof checks become static true/false
        // For byte array parameters, string checks should be false (data is &[u8], not String)
        const typeCheck = node.right.value;
        const arg = node.left.argument;
        const argName = arg?.name || arg?.property?.name || '';
        const lowerName = String(argName).toLowerCase();

        // Determine the Rust type from the context
        const isSlice = lowerName.includes('data') || lowerName.includes('bytes') ||
                       lowerName.includes('block') || lowerName.includes('input') ||
                       lowerName.includes('message') || lowerName.includes('plaintext') ||
                       lowerName.includes('ciphertext');

        // typeof x === 'string' on a &[u8] is always false
        // typeof x !== 'string' on a &[u8] is always true
        if (typeCheck === 'string' && isSlice) {
          return RustLiteral.Bool(operator === '!=');
        }
        // typeof x === 'object' on a slice/Vec is always true (objects in JS terms)
        if (typeCheck === 'object' && isSlice) {
          return RustLiteral.Bool(operator === '==');
        }

        // For unknown cases, just return true (type matches) or fallback to compile-time check
        return RustLiteral.Bool(true);
      }

      return new RustBinaryExpression(left, operator, right);
    }

    /**
     * Transform a unary expression
     */
    transformUnaryExpression(node) {
      const operand = this.transformExpression(node.argument);

      let operator = node.operator;
      if (operator === 'typeof') {
        // Rust doesn't have typeof, use type_name with reference to operand
        const refExpr = new RustUnaryExpression('&', operand);
        return new RustMacroCall('std::any::type_name', refExpr);
      }

      // Handle JavaScript truthy checks for non-boolean types in Rust
      if (operator === '!') {
        // Check what type of value we're negating
        const argName = node.argument?.name || node.argument?.property;
        if (argName) {
          const lowerName = String(argName).toLowerCase();
          // For arrays/slices/vectors (parameters), use .is_empty()
          // These are typically passed by reference and can't be None
          if (lowerName.includes('data') || lowerName.includes('bytes') ||
              lowerName.includes('block') || lowerName.includes('arr') ||
              lowerName.includes('vec') || lowerName.includes('input') ||
              lowerName.includes('output')) {
            return new RustMethodCall(operand, 'is_empty', []);
          }
        }
        // For field access like self.key, check the field name
        if (node.argument?.type === 'MemberExpression' ||
            node.argument?.type === 'ThisPropertyAccess') {
          const propName = node.argument?.property?.name || node.argument?.property;
          if (propName) {
            const lowerName = String(propName).toLowerCase();
            // Option fields (null-initialized) -> .is_none()
            if (lowerName.includes('key') || lowerName.includes('buffer') ||
                lowerName.includes('state')) {
              return new RustMethodCall(operand, 'is_none', []);
            }
            // Non-option collection fields -> .is_empty()
            if (lowerName.includes('data') || lowerName.includes('input') ||
                lowerName.includes('output') || lowerName.includes('bytes')) {
              return new RustMethodCall(operand, 'is_empty', []);
            }
          }
        }
      }

      return new RustUnaryExpression(operator, operand);
    }

    /**
     * Transform an assignment expression
     */
    transformAssignmentExpression(node) {
      const left = this.transformExpression(node.left, true);  // isLValue=true for left side
      let right = this.transformExpression(node.right);

      // Check if we're assigning to an Option field (like self.key)
      if (node.left?.type === 'MemberExpression' || node.left?.type === 'ThisPropertyAccess') {
        const propName = node.left?.property?.name || node.left?.property;
        if (propName) {
          const lowerName = String(propName).toLowerCase();
          const fieldType = this.structFieldTypes.get(this.toSnakeCase(propName));

          // Check if the target field is an Option type
          const isOptionField = (fieldType && fieldType.name === 'Option') ||
            lowerName === 'key' || lowerName === '_key' ||
            lowerName === 'iv' || lowerName === '_iv' ||
            lowerName === 'nonce' || lowerName === '_nonce' ||
            (lowerName.includes('buffer') && this.structFieldTypes.get(this.toSnakeCase(propName))?.name === 'Option');

          if (isOptionField && node.operator === '=') {
            // Check if right side is not None/null
            const rightNode = node.right;
            const isNullish = (rightNode?.type === 'Literal' && (rightNode.value === null || rightNode.value === undefined)) ||
                              (rightNode?.type === 'Identifier' && (rightNode.name === 'null' || rightNode.name === 'None' || rightNode.name === 'undefined'));

            if (!isNullish) {
              // Wrap the value in Some()
              // For parameters that are slices/references (like key_bytes: &[u8]), use Some(value.to_vec())
              const rightName = String(rightNode?.name || '').toLowerCase();
              const isSliceParam = rightName.includes('bytes') ||
                                   rightName.includes('key') ||
                                   rightName.includes('iv') ||
                                   rightName.includes('nonce') ||
                                   rightName.includes('data');

              if (isSliceParam && rightNode?.type === 'Identifier') {
                // For slice parameters, convert to owned Vec: Some(param.to_vec())
                right = new RustCall(new RustIdentifier('Some'), [
                  new RustMethodCall(right, 'to_vec', [])
                ]);
              } else if (rightNode?.type === 'ArrayExpression') {
                // For array literals, wrap directly
                right = new RustCall(new RustIdentifier('Some'), [right]);
              } else {
                right = new RustCall(new RustIdentifier('Some'), [right]);
              }
            }
          }

          // Check if field type is usize and right side is a numeric literal
          if (fieldType && fieldType.name === 'usize' && right?.nodeType === 'Literal' && right.suffix === 'u32') {
            right = RustLiteral.UInt(right.value, 'usize');
          }
        }
      }

      // For compound assignment operators (+=, -=, *=, /=, %=), match RHS type to LHS variable type
      const compoundOps = ['+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='];
      if (compoundOps.includes(node.operator)) {
        // Get the type of the LHS variable
        let lhsType = null;
        if (node.left?.type === 'Identifier') {
          lhsType = this.getVariableType(node.left.name);
        } else if (node.left?.type === 'ThisPropertyAccess') {
          const fieldName = this.toSnakeCase(node.left.property);
          lhsType = this.structFieldTypes.get(fieldName);
        }

        if (lhsType) {
          const intTypes = ['u8', 'u16', 'u32', 'u64', 'i8', 'i16', 'i32', 'i64', 'usize', 'isize'];
          if (intTypes.includes(lhsType.name)) {
            // Case 1: RHS is a literal - update suffix
            if (right?.nodeType === 'Literal' && typeof right.value === 'number') {
              right = RustLiteral.UInt(right.value, lhsType.name);
            }
            // Case 2: RHS is a variable with different type - cast it
            else if (node.right?.type === 'Identifier') {
              const rhsType = this.getVariableType(node.right.name);
              if (rhsType && intTypes.includes(rhsType.name) && rhsType.name !== lhsType.name) {
                // Cast RHS to LHS type
                const targetType = new RustType(lhsType.name);
                right = new RustCast(right, targetType);
              }
            }
          }
        }
      }

      return new RustAssignment(left, node.operator, right);
    }

    /**
     * Transform an update expression (++, --)
     */
    transformUpdateExpression(node) {
      const operand = this.transformExpression(node.argument);

      // Rust doesn't have ++ or --, use += 1 or -= 1
      const op = node.operator === '++' ? '+=' : '-=';
      return new RustAssignment(operand, op, new RustLiteral(1, 'int'));
    }

    /**
     * Transform a member expression
     * @param {Object} node - AST node
     * @param {boolean} isLValue - True if this is the left side of an assignment
     */
    transformMemberExpression(node, isLValue = false) {
      if (node.computed) {
        // Array indexing - indices must be usize in Rust
        let object = this.transformExpression(node.object, isLValue);
        let index = this.transformExpression(node.property);

        // If the index is a numeric literal, make it usize
        if (node.property?.type === 'Literal' && typeof node.property.value === 'number') {
          index = RustLiteral.UInt(node.property.value, 'usize');
        }
        // If the index is a non-literal u32 expression, cast to usize
        // This handles cases like arr[j & 3] where j is u32
        else if (node.property?.type !== 'Identifier' ||
                 this.getU32Variables().includes(node.property.name?.toLowerCase())) {
          // Check if it's an identifier that's already usize (loop counters like 'i')
          const isUsizeVar = node.property?.type === 'Identifier' &&
                             ['i', 'k', 'n', 'idx', 'index', 'round', 'offset', 'pos', 'position'].includes(
                               node.property.name?.toLowerCase());
          if (!isUsizeVar) {
            // Cast to usize for array indexing
            index = new RustCast(index, RustType.Usize());
          }
        }

        // Check if we're indexing into an Option field (like self.key)
        // If so, we need to unwrap it first: self.key.as_ref().unwrap()[i] for reading
        // or self.key.as_mut().unwrap()[i] for writing
        if (node.object?.type === 'MemberExpression' || node.object?.type === 'ThisPropertyAccess') {
          const propName = node.object?.property?.name || node.object?.property;
          if (propName) {
            const lowerName = String(propName).toLowerCase();
            const fieldType = this.structFieldTypes.get(this.toSnakeCase(propName));
            const isOptionField = (fieldType && fieldType.name === 'Option') ||
              lowerName === 'key' || lowerName === '_key' ||
              lowerName.includes('sum') || lowerName.includes('key_word') || lowerName.includes('words');

            if (isOptionField) {
              // Use as_mut for lvalue (writing), as_ref for rvalue (reading)
              const accessMethod = isLValue ? 'as_mut' : 'as_ref';
              object = new RustMethodCall(
                new RustMethodCall(object, accessMethod, []),
                'unwrap',
                []
              );
            }
          }
        }

        return new RustIndex(object, index);
      }

      // Field access
      const field = node.property.name || node.property.value;

      // Handle special properties
      if (field === 'length') {
        const object = this.transformExpression(node.object);
        return new RustMethodCall(object, 'len', []);
      }

      // Check if this is an enum/const member access (Type.VARIANT pattern)
      // Common patterns: CategoryType.BLOCK, SecurityStatus.SECURE, etc.
      // Also handle nested: AlgorithmFramework.CategoryType.BLOCK -> CategoryType::BLOCK

      // Helper to check if a name is likely an enum type
      const enumPatterns = ['Type', 'Status', 'Code', 'Mode', 'Kind', 'Category', 'Level'];
      const isLikelyEnumName = (name) => typeof name === 'string' && enumPatterns.some(p => name.endsWith(p) || name.includes(p));
      const isEnumVariant = /^[A-Z][A-Z0-9_]*$/.test(field) || /^[A-Z][a-zA-Z0-9]*$/.test(field);

      // Check for nested MemberExpression: Namespace.EnumType.VARIANT
      if (node.object.type === 'MemberExpression') {
        const innerObj = node.object.object;
        const innerProp = node.object.property?.name || node.object.property?.value;

        // Check if inner property is an enum type name
        if (innerProp && (isLikelyEnumName(innerProp) || isEnumVariant)) {
          // AlgorithmFramework.CategoryType.BLOCK -> CategoryType::BLOCK
          const enumName = this.toPascalCase(innerProp);
          const variantName = field.toUpperCase(); // Keep enum variants uppercase
          return new RustIdentifier(`${enumName}::${variantName}`);
        }
      }

      if (node.object.type === 'Identifier') {
        const objName = node.object.name;
        // Detect enum-like types (names ending with Type, Status, Code, etc.)
        const isLikelyEnum = isLikelyEnumName(objName);

        if (isLikelyEnum || isEnumVariant) {
          // Use :: syntax for enum variant access: CategoryType::BLOCK
          const enumName = this.toPascalCase(objName);
          const variantName = field.toUpperCase(); // Keep enum variants uppercase
          return new RustIdentifier(`${enumName}::${variantName}`);
        }
      }

      const object = this.transformExpression(node.object);

      // For self.x fields, remove leading underscore (Rust uses visibility modifiers)
      let fieldName = this.toSnakeCase(field);
      if (node.object.type === 'ThisExpression' && fieldName.startsWith('_'))
        fieldName = fieldName.substring(1);

      return new RustFieldAccess(object, fieldName);
    }

    /**
     * Transform a call expression
     */
    transformCallExpression(node) {
      // Handle OpCodes method calls
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'OpCodes') {
        return this.transformOpCodesCall(node);
      }

      // Handle method calls
      if (node.callee.type === 'MemberExpression') {
        const object = this.transformExpression(node.callee.object);
        const method = node.callee.property.name || node.callee.property.value;
        const methodName = this.toSafeSnakeCase(method);

        // Transform arguments, adding references for byte array variables when calling methods on self
        const args = node.arguments.map(arg => {
          let transformed = this.transformExpression(arg);

          // Check object type - could be ThisExpression or ThisPropertyAccess from IL AST
          const isThisCall = node.callee.object.type === 'ThisExpression' ||
                             node.callee.object.type === 'ThisPropertyAccess' ||
                             (node.callee.object.type === 'Identifier' && node.callee.object.name === 'self');

          // Skip adding references for internal methods (prefixed with _)
          // These typically take owned values (Vec<u8>) not references (&[u8])
          const isInternalMethod = methodName.startsWith('_');

          // If calling a method on self/this and the argument is a variable that holds byte data,
          // we likely need to pass it as a reference (method expects &[u8] but var is Vec<u8>)
          // But NOT for internal methods which typically take owned values
          if (isThisCall && !isInternalMethod && arg.type === 'Identifier') {
            const argName = arg.name.toLowerCase();
            // Check if the variable name suggests byte data
            if (argName.includes('block') || argName.includes('data') ||
                argName.includes('key') || argName.includes('buffer') ||
                argName.includes('bytes') || argName.includes('input') ||
                argName.includes('output')) {
              // Wrap in reference - method expects &[u8] but we have Vec<u8>
              return new RustUnaryExpression('&', transformed);
            }
          }
          return transformed;
        });

        // Handle Object methods (JavaScript built-ins)
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'Object') {
          // Object.freeze(x) -> x (Rust has immutability by default)
          if (method === 'freeze' && args.length === 1)
            return args[0];
          // Object.keys(obj) -> obj.keys().collect::<Vec<_>>()
          if (method === 'keys' && args.length === 1)
            return new RustMethodCall(new RustMethodCall(args[0], 'keys', []), 'collect', []);
          // Object.values(obj) -> obj.values().collect::<Vec<_>>()
          if (method === 'values' && args.length === 1)
            return new RustMethodCall(new RustMethodCall(args[0], 'values', []), 'collect', []);
          // Object.entries(obj) -> obj.iter().collect::<Vec<_>>()
          if (method === 'entries' && args.length === 1)
            return new RustMethodCall(new RustMethodCall(args[0], 'iter', []), 'collect', []);
          // Object.assign -> clone and extend
          if (method === 'assign' && args.length >= 2)
            return new RustMethodCall(args[0], 'clone', []);
        }

        // Handle String methods (JavaScript built-ins)
        if (node.callee.object.type === 'Identifier' &&
            (node.callee.object.name === 'String' || node.callee.object.name === 'string')) {
          // String.fromCharCode(code) -> code as u8 as char or char::from_u32(code as u32).unwrap_or('\0')
          // Also handle snake_case from_char_code from IL transformation
          if ((method === 'fromCharCode' || method === 'from_char_code') && args.length >= 1) {
            if (args.length === 1) {
              // Single char: code as u8 as char
              return new RustCast(new RustCast(args[0], 'u8'), 'char');
            }
            // Multiple args: create a string from multiple chars
            // chars = [c1 as u8 as char, c2 as u8 as char, ...].iter().collect::<String>()
            const chars = args.map(a => new RustCast(new RustCast(a, 'u8'), 'char'));
            const arrayLit = new RustArrayLiteral(chars);
            return new RustMethodCall(
              new RustMethodCall(arrayLit, 'iter', []),
              'collect::<String>',
              []
            );
          }
        }

        // Handle Array methods (JavaScript built-ins)
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'Array') {
          // Array.isArray(x) -> true (in Rust, Vec/slice is always an array-like)
          // We just return true since Rust's type system handles this at compile time
          if (method === 'isArray' && args.length === 1)
            return new RustLiteral(true, 'bool');
          // Array.from(iterable) -> iterable.iter().collect()
          if (method === 'from' && args.length >= 1)
            return new RustMethodCall(new RustMethodCall(args[0], 'iter', []), 'collect', []);
        }

        // Handle Math methods (JavaScript built-ins)
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'Math') {
          // Math.imul(a, b) -> a.wrapping_mul(b) for 32-bit integer multiplication with overflow
          if (method === 'imul' && args.length === 2)
            return new RustMethodCall(args[0], 'wrapping_mul', [args[1]]);
          // Math.floor(x) -> x.floor() for floats, or x for integers
          if (method === 'floor' && args.length === 1)
            return new RustMethodCall(args[0], 'floor', []);
          // Math.ceil(x) -> x.ceil()
          if (method === 'ceil' && args.length === 1)
            return new RustMethodCall(args[0], 'ceil', []);
          // Math.round(x) -> x.round()
          if (method === 'round' && args.length === 1)
            return new RustMethodCall(args[0], 'round', []);
          // Math.abs(x) -> x.abs()
          if (method === 'abs' && args.length === 1)
            return new RustMethodCall(args[0], 'abs', []);
          // Math.min(a, b) -> a.min(b)
          if (method === 'min' && args.length >= 2) {
            let result = args[0];
            for (let i = 1; i < args.length; ++i)
              result = new RustMethodCall(result, 'min', [args[i]]);
            return result;
          }
          // Math.max(a, b) -> a.max(b)
          if (method === 'max' && args.length >= 2) {
            let result = args[0];
            for (let i = 1; i < args.length; ++i)
              result = new RustMethodCall(result, 'max', [args[i]]);
            return result;
          }
          // Math.pow(base, exp) -> base.pow(exp)
          if (method === 'pow' && args.length === 2)
            return new RustMethodCall(args[0], 'pow', [args[1]]);
          // Math.sqrt(x) -> x.sqrt()
          if (method === 'sqrt' && args.length === 1)
            return new RustMethodCall(args[0], 'sqrt', []);
          // Math.log(x) -> x.ln()
          if (method === 'log' && args.length === 1)
            return new RustMethodCall(args[0], 'ln', []);
          // Math.log2(x) -> x.log2()
          if (method === 'log2' && args.length === 1)
            return new RustMethodCall(args[0], 'log2', []);
          // Math.random() -> rand::random() (requires rand crate)
          if (method === 'random' && args.length === 0)
            return new RustCall(new RustIdentifier('rand::random'), []);
          // Math.trunc(x) -> x.trunc()
          if (method === 'trunc' && args.length === 1)
            return new RustMethodCall(args[0], 'trunc', []);
          // Math.sign(x) -> x.signum()
          if (method === 'sign' && args.length === 1)
            return new RustMethodCall(args[0], 'signum', []);
          // Math.clz32(x) -> x.leading_zeros()
          if (method === 'clz32' && args.length === 1)
            return new RustMethodCall(args[0], 'leading_zeros', []);
        }

        // Handle array instance methods
        if (method === 'push') {
          // Check for spread: arr.push(...other) -> arr.extend(other)
          if (node.arguments.length === 1 && node.arguments[0].type === 'SpreadElement') {
            const spreadArg = this.transformExpression(node.arguments[0].argument);
            return new RustMethodCall(object, 'extend', [spreadArg]);
          }

          // Look up the array's element type for type coercion
          let pushArg = args[0];
          let varName = node.callee?.object?.name;
          if (varName && node.arguments.length === 1) {
            const varType = this.getVariableType(varName);
            if (varType && varType.name === 'Vec' && varType.genericArguments?.[0]) {
              const elemArg = varType.genericArguments[0];
              const rustElemType = typeof elemArg === 'string' ? elemArg : (elemArg?.name || null);
              if (rustElemType) {
                const valueNode = node.arguments[0];
                const valueType = this.inferTypeFromValue(valueNode);
                const valueTypeName = valueType?.name || 'u32';

                // Special handling: Cast/TypeConversion to i32 being pushed to u32 array - skip the i32 cast
                const isCastLikeNode = valueNode?.type === 'Cast' || valueNode?.type === 'TypeConversion';
                if (valueTypeName === 'i32' && rustElemType === 'u32' && isCastLikeNode) {
                  const innerArg = valueNode.arguments?.[0] || valueNode.argument || valueNode.value;
                  if (innerArg) {
                    // Transform the inner expression directly, skipping the i32 cast
                    pushArg = this.transformExpression(innerArg);
                    // If the inner expr returns u32, no additional cast needed
                    const innerType = this.inferTypeFromValue(innerArg);
                    if (innerType?.name !== 'u32') {
                      pushArg = new RustCast(pushArg, new RustType('u32'));
                    }
                  }
                } else if (valueTypeName !== rustElemType) {
                  pushArg = new RustCast(args[0], new RustType(rustElemType));
                }
              }
            }
          }

          // Regular push: arr.push(x) -> arr.push(x)
          return new RustMethodCall(object, 'push', [pushArg]);
        }

        // Handle concat: arr.concat(other) -> [arr, other].concat()
        if (method === 'concat' && args.length >= 1) {
          // Create [arr1, arr2, ...].concat() pattern for Rust
          return new RustMethodCall(
            new RustArrayLiteral([object, ...args]),
            'concat',
            []
          );
        }

        // Handle string methods
        // str.split('') -> str.chars() or str.bytes() for character iteration
        if (method === 'split' && args.length >= 1) {
          // Check if splitting by empty string (character by character)
          if (node.arguments[0]?.type === 'Literal' && node.arguments[0].value === '') {
            // str.split('') -> str.chars().collect::<Vec<_>>() for character-by-character split
            return new RustMethodCall(
              new RustMethodCall(object, 'chars', []),
              'collect',
              []
            );
          }
          // str.split(sep) -> str.split(sep).collect::<Vec<_>>()
          return new RustMethodCall(
            new RustMethodCall(object, 'split', args),
            'collect',
            []
          );
        }

        // Handle map method: arr.map(fn) -> arr.iter().map(fn).collect()
        if (method === 'map' && args.length >= 1) {
          // Check if the callback is an arrow function
          const callback = node.arguments[0];
          if (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression') {
            // Transform: arr.map(x => x + 1) -> arr.iter().map(|x| x + 1).collect()
            const param = callback.params?.[0]?.name || 'x';
            const body = this.transformExpression(callback.body);
            const closure = new RustClosure([param], body);
            return new RustMethodCall(
              new RustMethodCall(
                new RustMethodCall(object, 'iter', []),
                'map',
                [closure]
              ),
              'collect',
              []
            );
          }
          // If callback is already a function reference, use it directly
          return new RustMethodCall(
            new RustMethodCall(
              new RustMethodCall(object, 'iter', []),
              'map',
              args
            ),
            'collect',
            []
          );
        }

        // Handle charCodeAt: str.charCodeAt(i) -> str.as_bytes()[i as usize]
        if (method === 'charCodeAt') {
          let index = args.length > 0 ? args[0] : RustLiteral.UInt(0, 'usize');
          // Ensure index is usize (Rust requires usize for array indexing)
          if (index.nodeType === 'Literal' && index.suffix && index.suffix !== 'usize') {
            index = new RustCast(index, RustType.Usize());
          }
          return new RustIndex(
            new RustMethodCall(object, 'as_bytes', []),
            index
          );
        }

        return new RustMethodCall(object, methodName, args);
      }

      // Regular function call
      const callee = this.transformExpression(node.callee);
      const args = node.arguments.map(arg => this.transformExpression(arg));

      return new RustCall(callee, args);
    }

    /**
     * Transform OpCodes method calls to Rust equivalents
     */
    transformOpCodesCall(node) {
      const methodName = node.callee.property.name;
      const args = node.arguments.map(arg => this.transformExpression(arg));

      // Map OpCodes methods to Rust equivalents
      switch (methodName) {
        // Rotation operations
        case 'RotL32':
        case 'RotL64':
          return new RustMethodCall(args[0], 'rotate_left', [args[1]]);

        case 'RotR32':
        case 'RotR64':
          return new RustMethodCall(args[0], 'rotate_right', [args[1]]);

        case 'RotL8':
          // Cast to u8, rotate, cast back
          return new RustMethodCall(
            new RustCast(args[0], RustType.U8()),
            'rotate_left',
            [args[1]]
          );

        case 'RotR8':
          return new RustMethodCall(
            new RustCast(args[0], RustType.U8()),
            'rotate_right',
            [args[1]]
          );

        // Byte packing - little endian
        case 'Pack32LE':
          return new RustMethodCall(
            new RustIdentifier('u32'),
            'from_le_bytes',
            [new RustArrayLiteral(args)]
          );

        case 'Pack64LE':
          return new RustMethodCall(
            new RustIdentifier('u64'),
            'from_le_bytes',
            [new RustArrayLiteral(args)]
          );

        case 'Pack16LE':
          return new RustMethodCall(
            new RustIdentifier('u16'),
            'from_le_bytes',
            [new RustArrayLiteral(args)]
          );

        // Byte packing - big endian
        case 'Pack32BE':
          return new RustMethodCall(
            new RustIdentifier('u32'),
            'from_be_bytes',
            [new RustArrayLiteral(args)]
          );

        case 'Pack64BE':
          return new RustMethodCall(
            new RustIdentifier('u64'),
            'from_be_bytes',
            [new RustArrayLiteral(args)]
          );

        case 'Pack16BE':
          return new RustMethodCall(
            new RustIdentifier('u16'),
            'from_be_bytes',
            [new RustArrayLiteral(args)]
          );

        // Byte unpacking - little endian
        case 'Unpack32LE':
          return new RustMethodCall(args[0], 'to_le_bytes', []);

        case 'Unpack64LE':
          return new RustMethodCall(args[0], 'to_le_bytes', []);

        case 'Unpack16LE':
          return new RustMethodCall(args[0], 'to_le_bytes', []);

        // Byte unpacking - big endian
        case 'Unpack32BE':
          return new RustMethodCall(args[0], 'to_be_bytes', []);

        case 'Unpack64BE':
          return new RustMethodCall(args[0], 'to_be_bytes', []);

        case 'Unpack16BE':
          return new RustMethodCall(args[0], 'to_be_bytes', []);

        // Array operations
        case 'XorArrays':
          // Use zip and map: a.iter().zip(b.iter()).map(|(x, y)| x ^ y).collect()
          return new RustCall(new RustIdentifier('xor_arrays'), args);

        case 'ClearArray':
          return new RustMethodCall(args[0], 'fill', [new RustLiteral(0, 'u8')]);

        // Conversion utilities
        case 'Hex8ToBytes':
          return new RustCall(new RustIdentifier('hex_to_bytes'), args);

        case 'BytesToHex8':
          return new RustCall(new RustIdentifier('bytes_to_hex'), args);

        case 'AnsiToBytes':
          // Convert string to bytes
          return new RustMethodCall(args[0], 'as_bytes', []);

        case 'BytesToAnsi':
          // Convert bytes to string
          return new RustCall(
            new RustFieldAccess(new RustIdentifier('String'), 'from_utf8_lossy'),
            [args[0]]
          );

        default:
          // Default to function call with snake_case naming
          return new RustCall(new RustIdentifier(this.toSnakeCase(methodName)), args);
      }
    }

    /**
     * Transform an array expression
     */
    transformArrayExpression(node) {
      // Check for single spread element: [...arr] should become arr.to_vec() or arr.clone()
      if (node.elements.length === 1 && node.elements[0]?.type === 'SpreadElement') {
        const spreadArg = this.transformExpression(node.elements[0].argument);
        // [...arr] becomes arr.to_vec() to clone the array
        return new RustMethodCall(spreadArg, 'to_vec', []);
      }

      // Check if ALL elements are spread elements: [...a, ...b] -> [a, b].concat()
      const allSpreads = node.elements.length > 1 &&
                         node.elements.every(elem => elem?.type === 'SpreadElement');
      if (allSpreads) {
        // [...a, ...b, ...c] -> [a, b, c].concat()
        const spreadArgs = node.elements.map(elem =>
          this.transformExpression(elem.argument)
        );
        // Create [arr1, arr2].concat() pattern
        return new RustMethodCall(
          new RustArrayLiteral(spreadArgs),
          'concat',
          []
        );
      }

      const elements = node.elements.map(elem => {
        // Handle spread elements: [...other, elem] -> needs extend
        if (elem?.type === 'SpreadElement') {
          return this.transformExpression(elem.argument);
        }
        return this.transformExpression(elem);
      });

      // Use vec! macro for dynamic arrays
      return new RustVecMacro(elements);
    }

    /**
     * Transform a new expression
     */
    transformNewExpression(node) {
      if (node.callee.type === 'Identifier') {
        const typeName = node.callee.name;

        // Map TypedArrays to Rust Vec types
        const typedArrayMap = {
          'Uint8Array': 'u8',
          'Uint16Array': 'u16',
          'Uint32Array': 'u32',
          'Int8Array': 'i8',
          'Int16Array': 'i16',
          'Int32Array': 'i32',
          'Float32Array': 'f32',
          'Float64Array': 'f64'
        };

        if (typedArrayMap[typeName]) {
          const hasArrayInit = node.arguments.length > 0 &&
            node.arguments[0].type === 'ArrayExpression';

          if (hasArrayInit) {
            // new Uint8Array([1, 2, 3]) -> vec![1u8, 2u8, 3u8]
            const elements = node.arguments[0].elements.map(e => this.transformExpression(e));
            return new RustMacroCall('vec', elements);
          }

          // new Uint8Array(n) -> vec![0u8; n]
          let size = node.arguments[0] ? this.transformExpression(node.arguments[0]) : new RustLiteral(0, 'usize');
          // Ensure size is usize (vec! repeat size must be usize)
          size = this.coerceToUsize(size);
          return new RustMacroCall('vec', [new RustLiteral(0, typedArrayMap[typeName]), size], '; ');
        }

        // Handle Array constructor
        if (typeName === 'Array') {
          if (node.arguments.length === 1) {
            // new Array(n) -> Vec::with_capacity(n)
            const size = this.transformExpression(node.arguments[0]);
            return new RustCall(new RustFieldAccess(new RustIdentifier('Vec'), 'with_capacity'), [size]);
          }
          return new RustMacroCall('vec', []);
        }

        const pascalTypeName = this.toPascalCase(typeName);

        // Skip 'this' as first argument if calling an Instance constructor
        // This matches skipping the 'algorithm' parameter in the constructor
        let filteredArgs = node.arguments;
        if (filteredArgs.length > 0 && filteredArgs[0].type === 'ThisExpression') {
          filteredArgs = filteredArgs.slice(1);
        }

        let args = filteredArgs.map(arg => this.transformExpression(arg));

        // Handle Vulnerability constructor overloads
        // JS: new Vulnerability(name, description, mitigation) - 3 args
        // JS: new Vulnerability(name, url, description, mitigation) - 4 args
        // Rust: Vulnerability::new(name, url, description, mitigation) - always 4 args
        if (typeName === 'Vulnerability' && args.length === 3) {
          // Insert empty string for url between name and description
          args = [args[0], RustLiteral.String(''), args[1], args[2]];
        }

        // Call the 'new' associated function using :: syntax
        // Use RustIdentifier with full path since Rust uses TypeName::new() not TypeName.new()
        return new RustCall(
          new RustIdentifier(`${pascalTypeName}::new`),
          args
        );
      }

      // Handle MemberExpression callees: new Namespace.ClassName(...)
      // e.g., new AlgorithmFramework.LinkItem(...) -> LinkItem::new(...)
      if (node.callee.type === 'MemberExpression') {
        const typeName = node.callee.property?.name || node.callee.property?.value;
        if (typeName) {
          const pascalTypeName = this.toPascalCase(typeName);
          const args = node.arguments.map(arg => this.transformExpression(arg));
          return new RustCall(
            new RustIdentifier(`${pascalTypeName}::new`),
            args
          );
        }
      }

      return null;
    }

    /**
     * Transform a conditional expression
     */
    transformConditionalExpression(node) {
      const condition = this.transformExpression(node.test);
      const thenExpr = this.transformExpression(node.consequent);
      const elseExpr = this.transformExpression(node.alternate);

      return new RustIfExpression(condition, thenExpr, elseExpr);
    }

    /**
     * Transform an object expression to Rust struct literal
     */
    transformObjectExpression(node) {
      // Collect key-value pairs
      const pairs = [];
      for (const prop of node.properties) {
        // Handle spread properties and missing keys
        if (!prop.key) {
          // SpreadElement or other property without key
          if (prop.type === 'SpreadElement' && prop.argument) {
            // Skip spread for now - would need to merge
            continue;
          }
          continue;
        }
        const key = prop.key.name || prop.key.value || 'unknown';
        const keyLiteral = RustLiteral.String(String(key));
        const value = this.transformExpression(prop.value);
        // Create tuple (key, value)
        pairs.push(new RustTuple([keyLiteral, value]));
      }

      // Use HashMap::from() with array of tuples: HashMap::from([("k1", v1), ("k2", v2)])
      const tupleArray = new RustArrayLiteral(pairs);
      return new RustCall(new RustIdentifier('HashMap::from'), [tupleArray]);
    }

    /**
     * Transform a function expression to Rust closure
     */
    transformFunctionExpression(node) {
      // Map parameters
      const params = node.params ? node.params.map(p => {
        const paramName = this.toSnakeCase(p.name);
        const paramType = this.inferTypeFromName(p.name);
        return new RustParameter(paramName, paramType);
      }) : [];

      // Transform body
      let body = null;
      if (node.body) {
        if (node.body.type === 'BlockStatement') {
          body = this.transformBlockStatement(node.body);
        } else {
          // Arrow function with expression body
          body = this.transformExpression(node.body);
        }
      }

      return new RustClosure(params, body);
    }

    /**
     * Transform logical expression (&&, ||)
     * Note: JavaScript's || can be null-coalescing (returns first truthy value)
     * In Rust, || is strictly boolean. For null-coalescing, we use .unwrap_or() or if-else
     */
    transformLogicalExpression(node) {
      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);

      // Check if this is a boolean context or null-coalescing
      // If left operand is not a boolean type, this is likely null-coalescing
      if (node.operator === '||') {
        const leftType = this.inferTypeFromValue(node.left);
        // If left type is not bool, treat as null-coalescing
        if (leftType && leftType.name !== 'bool') {
          // For Option types, use .unwrap_or()
          // For other types, use if-else pattern
          // Emit: if left.is_some() { left.unwrap() } else { right }
          // Or for simpler cases: left.unwrap_or_else(|| right)
          // For simplicity, use .unwrap_or() pattern
          return new RustMethodCall(left, 'unwrap_or', [right]);
        }
      }

      // Boolean logical expression - use as-is
      return new RustBinaryExpression(left, node.operator, right);
    }

    /**
     * Transform spread element: ...array
     * In Rust, this typically means extending a Vec or using iterator
     */
    transformSpreadElement(node) {
      // Just transform the argument - spread handling depends on context
      return this.transformExpression(node.argument);
    }

    /**
     * Transform template literal: `Hello ${name}!` -> format!("Hello {}!", name)
     */
    transformTemplateLiteral(node) {
      let formatStr = '';
      const args = [];

      for (let i = 0; i < node.quasis.length; ++i) {
        formatStr += node.quasis[i].value.raw.replace(/{/g, '{{').replace(/}/g, '}}');
        if (i < node.expressions.length) {
          formatStr += '{}';
          args.push(this.transformExpression(node.expressions[i]));
        }
      }

      // Use format! macro - format string should be &str (no .to_string())
      return new RustMacroCall('format!', [
        RustLiteral.Str(formatStr),
        ...args
      ]);
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
  const exports = { RustTransformer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.RustTransformer = RustTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
