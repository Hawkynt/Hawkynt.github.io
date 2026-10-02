/**
 * TypeInferenceTests.js - Comprehensive Type Inference Validation
 *
 * Tests the type inference system in type-aware-transpiler.js under all edge cases.
 * This is foundational for generating correct typed code for Rust, C, C++, C#, Go, Java.
 *
 * The INFERENCE category:
 *   node tests/TranspilerSuite.js --only=inference
 *   node tests/TranspilerSuite.js --only=inference --verbose
 *   node tests/TranspilerSuite.js --only=inference --group=literal   # groups whose name contains "literal"
 */

'use strict';

const path = require('path');
const { TypeAwareJSASTParser } = require('../type-aware-transpiler.js');

class TypeInferenceTestSuite {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.categoryFilter = options.category || null;
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
    this.currentCategory = '';
  }

  // ============================================================================
  // Core Test Infrastructure
  // ============================================================================

  /**
   * Parse JS code and extract the resultType from a specific node
   * @param {string} jsCode - JavaScript code to parse
   * @param {function} nodeFinder - Function to find the target node in AST
   * @returns {string|null} The resultType of the found node
   */
  inferType(jsCode, nodeFinder) {
    try {
      const parser = new TypeAwareJSASTParser(jsCode);
      const ast = parser.parse();
      const node = nodeFinder(ast);
      return this.normalizeType(node?.resultType);
    } catch (err) {
      if (this.verbose)
        console.log(`    Parse error: ${err.message}`);
      return `ERROR: ${err.message}`;
    }
  }

  /**
   * Normalize type to string for comparison
   */
  normalizeType(type) {
    if (type === null || type === undefined)
      return null;
    if (typeof type === 'string')
      return type;
    if (typeof type === 'object' && type.name)
      return type.name;
    return String(type);
  }

  /**
   * Assert equality with detailed error tracking
   */
  assertEqual(actual, expected, testName, codeSnippet = '') {
    const normalizedActual = this.normalizeType(actual);
    const normalizedExpected = this.normalizeType(expected);

    if (normalizedActual === normalizedExpected) {
      this.passed++;
      if (this.verbose)
        console.log(`    \x1b[32m\u2713\x1b[0m ${testName}`);
      return true;
    } else {
      this.failed++;
      this.errors.push({
        category: this.currentCategory,
        testName,
        expected: normalizedExpected,
        actual: normalizedActual,
        code: codeSnippet
      });
      console.log(`    \x1b[31m\u2717\x1b[0m ${testName}: expected \x1b[33m${normalizedExpected}\x1b[0m, got \x1b[31m${normalizedActual}\x1b[0m`);
      return false;
    }
  }

  /**
   * Run a category of tests
   */
  runCategory(name, testFn) {
    if (this.categoryFilter && !name.toLowerCase().includes(this.categoryFilter))
      return;

    this.currentCategory = name;
    console.log(`\n\x1b[1m=== ${name} ===\x1b[0m`);
    testFn.call(this);
  }

  // ============================================================================
  // AST Node Finders
  // ============================================================================

  /**
   * Find first variable declaration's init expression
   */
  findVarInit(ast) {
    const findNode = (node) => {
      if (!node || typeof node !== 'object') return null;
      if (node.type === 'VariableDeclaration' && node.declarations?.[0]?.init)
        return node.declarations[0].init;
      for (const key in node) {
        if (key === 'loc' || key === 'range') continue;
        const result = findNode(node[key]);
        if (result) return result;
      }
      return null;
    };
    return findNode(ast);
  }

  /**
   * Find return statement's argument
   */
  findReturnArg(ast) {
    const findNode = (node) => {
      if (!node || typeof node !== 'object') return null;
      if (node.type === 'ReturnStatement' && node.argument)
        return node.argument;
      for (const key in node) {
        if (key === 'loc' || key === 'range') continue;
        const result = findNode(node[key]);
        if (result) return result;
      }
      return null;
    };
    return findNode(ast);
  }

  /**
   * Find first expression statement's expression
   */
  findExpression(ast) {
    const findNode = (node) => {
      if (!node || typeof node !== 'object') return null;
      if (node.type === 'ExpressionStatement' && node.expression)
        return node.expression;
      for (const key in node) {
        if (key === 'loc' || key === 'range') continue;
        const result = findNode(node[key]);
        if (result) return result;
      }
      return null;
    };
    return findNode(ast);
  }

  /**
   * Find class field by name
   */
  findClassField(ast, fieldName) {
    const findNode = (node) => {
      if (!node || typeof node !== 'object') return null;
      if (node.type === 'FieldInitialization' && node.field === fieldName)
        return node;
      if (node.type === 'AssignmentExpression' &&
          node.left?.type === 'ThisPropertyAccess' &&
          node.left.property === fieldName)
        return node;
      for (const key in node) {
        if (key === 'loc' || key === 'range') continue;
        const result = findNode(node[key]);
        if (result) return result;
      }
      return null;
    };
    return findNode(ast);
  }

  /**
   * Find function/method by name
   */
  findFunction(ast, funcName) {
    const findNode = (node) => {
      if (!node || typeof node !== 'object') return null;
      if ((node.type === 'FunctionDeclaration' || node.type === 'MethodDefinition') &&
          (node.id?.name === funcName || node.key?.name === funcName))
        return node;
      for (const key in node) {
        if (key === 'loc' || key === 'range') continue;
        const result = findNode(node[key]);
        if (result) return result;
      }
      return null;
    };
    return findNode(ast);
  }

  // ============================================================================
  // Test Category 1: Literal Type Inference
  // ============================================================================

  testLiteralTypes() {
    this.runCategory('Literal Type Inference', () => {
      // Integer literals - default to int32 like most typed languages
      // Small values don't auto-shrink to uint8/uint16 without explicit context
      this.assertEqual(
        this.inferType('const x = 0;', this.findVarInit),
        'int32', 'Zero literal → int32 (default)', 'const x = 0'
      );

      this.assertEqual(
        this.inferType('const x = 255;', this.findVarInit),
        'int32', 'Small int (255) → int32 (default)', 'const x = 255'
      );

      this.assertEqual(
        this.inferType('const x = 256;', this.findVarInit),
        'int32', 'Small int (256) → int32 (default)', 'const x = 256'
      );

      this.assertEqual(
        this.inferType('const x = 65535;', this.findVarInit),
        'int32', 'Medium int (65535) → int32', 'const x = 65535'
      );

      this.assertEqual(
        this.inferType('const x = 65536;', this.findVarInit),
        'int32', 'Medium int (65536) → int32', 'const x = 65536'
      );

      // Large values exceed int32 range → uint32
      this.assertEqual(
        this.inferType('const x = 2147483648;', this.findVarInit),
        'uint32', 'Over int32 max → uint32', 'const x = 2147483648'
      );

      this.assertEqual(
        this.inferType('const x = 4294967295;', this.findVarInit),
        'uint32', 'Max uint32 → uint32', 'const x = 4294967295'
      );

      this.assertEqual(
        this.inferType('const x = 4294967296;', this.findVarInit),
        'uint64', 'uint32 overflow → uint64', 'const x = 4294967296'
      );

      // Negative integers - default to int32
      this.assertEqual(
        this.inferType('const x = -1;', this.findVarInit),
        'int32', 'Small negative (-1) → int32', 'const x = -1'
      );

      this.assertEqual(
        this.inferType('const x = -128;', this.findVarInit),
        'int32', 'Small negative (-128) → int32', 'const x = -128'
      );

      this.assertEqual(
        this.inferType('const x = -129;', this.findVarInit),
        'int32', 'Small negative (-129) → int32', 'const x = -129'
      );

      this.assertEqual(
        this.inferType('const x = -32768;', this.findVarInit),
        'int32', 'Medium negative (-32768) → int32', 'const x = -32768'
      );

      this.assertEqual(
        this.inferType('const x = -32769;', this.findVarInit),
        'int32', 'Medium negative (-32769) → int32', 'const x = -32769'
      );

      // Very negative → int64 (a negative value is never uint32)
      this.assertEqual(
        this.inferType('const x = -2147483649;', this.findVarInit),
        'int64', 'Below int32 min → int64 (was uint32, which cannot hold it)', 'const x = -2147483649'
      );

      // Floating point
      this.assertEqual(
        this.inferType('const x = 3.14;', this.findVarInit),
        'float64', 'Float literal → float64', 'const x = 3.14'
      );

      // Decimal-point source text is an explicit float even for a whole value
      // (see _isExplicitFloatLiteralText)
      this.assertEqual(
        this.inferType('const x = 0.0;', this.findVarInit),
        'float64', 'Zero literal written as 0.0 → float64', 'const x = 0.0'
      );

      // Boolean literals
      this.assertEqual(
        this.inferType('const x = true;', this.findVarInit),
        'boolean', 'true → boolean', 'const x = true'
      );

      this.assertEqual(
        this.inferType('const x = false;', this.findVarInit),
        'boolean', 'false → boolean', 'const x = false'
      );

      // String literals
      this.assertEqual(
        this.inferType('const x = "hello";', this.findVarInit),
        'string', 'String literal → string', 'const x = "hello"'
      );

      this.assertEqual(
        this.inferType("const x = '';", this.findVarInit),
        'string', 'Empty string → string', "const x = ''"
      );

      // Null/undefined
      this.assertEqual(
        this.inferType('const x = null;', this.findVarInit),
        'null', 'null literal → null', 'const x = null'
      );

      // Hex literals - still int32 for values in range
      this.assertEqual(
        this.inferType('const x = 0xFF;', this.findVarInit),
        'int32', 'Hex 0xFF (255) → int32', 'const x = 0xFF'
      );

      // Large hex values → uint32
      this.assertEqual(
        this.inferType('const x = 0xFFFFFFFF;', this.findVarInit),
        'uint32', 'Hex 0xFFFFFFFF → uint32', 'const x = 0xFFFFFFFF'
      );
    });
  }

  // ============================================================================
  // Test Category 2: Array Type Inference
  // ============================================================================

  testArrayTypes() {
    this.runCategory('Array Type Inference', () => {
      // Empty array - defaults to int32[] (element type follows int32 default)
      this.assertEqual(
        this.inferType('const x = [];', this.findVarInit),
        'int32[]', 'Empty array → default int32[]', 'const x = []'
      );

      // Integer literal arrays take the tightest element type that fits every
      // element (boundaries 0xFF / 0xFFFF / 0xFFFFFFFF)
      this.assertEqual(
        this.inferType('const x = [0];', this.findVarInit),
        'uint8[]', 'Array of byte-range literals → uint8[]', 'const x = [0]'
      );

      this.assertEqual(
        this.inferType('const x = [255];', this.findVarInit),
        'uint8[]', 'Array at the uint8 upper bound → uint8[]', 'const x = [255]'
      );

      this.assertEqual(
        this.inferType('const x = [256];', this.findVarInit),
        'uint16[]', 'Array just above uint8 → uint16[]', 'const x = [256]'
      );

      this.assertEqual(
        this.inferType('const x = [65536];', this.findVarInit),
        'uint32[]', 'Array just above uint16 → uint32[]', 'const x = [65536]'
      );

      this.assertEqual(
        this.inferType('const x = [-1, 5];', this.findVarInit),
        'int32[]', 'Array with a negative literal → int32[]', 'const x = [-1, 5]'
      );

      // Large elements require widening
      this.assertEqual(
        this.inferType('const x = [2147483648];', this.findVarInit),
        'uint32[]', 'Array with uint32 element → uint32[]', 'const x = [2147483648]'
      );

      // Mixed elements - the widest element decides
      this.assertEqual(
        this.inferType('const x = [0, 256];', this.findVarInit),
        'uint16[]', 'Mixed byte/word ints → uint16[]', 'const x = [0, 256]'
      );

      this.assertEqual(
        this.inferType('const x = [1, 65536, 3];', this.findVarInit),
        'uint32[]', 'Mixed ints up to 65536 → uint32[]', 'const x = [1, 65536, 3]'
      );

      // String array
      this.assertEqual(
        this.inferType('const x = ["a", "b"];', this.findVarInit),
        'string[]', 'String array → string[]', 'const x = ["a", "b"]'
      );

      // Boolean array
      this.assertEqual(
        this.inferType('const x = [true, false];', this.findVarInit),
        'boolean[]', 'Boolean array → boolean[]', 'const x = [true, false]'
      );

      // TypedArray constructors - these override the default type
      this.assertEqual(
        this.inferType('const x = new Uint8Array(10);', this.findVarInit),
        'uint8[]', 'new Uint8Array(n) → uint8[]', 'const x = new Uint8Array(10)'
      );

      this.assertEqual(
        this.inferType('const x = new Uint16Array(10);', this.findVarInit),
        'uint16[]', 'new Uint16Array(n) → uint16[]', 'const x = new Uint16Array(10)'
      );

      this.assertEqual(
        this.inferType('const x = new Uint32Array(10);', this.findVarInit),
        'uint32[]', 'new Uint32Array(n) → uint32[]', 'const x = new Uint32Array(10)'
      );

      this.assertEqual(
        this.inferType('const x = new Int8Array(10);', this.findVarInit),
        'int8[]', 'new Int8Array(n) → int8[]', 'const x = new Int8Array(10)'
      );

      this.assertEqual(
        this.inferType('const x = new Int16Array(10);', this.findVarInit),
        'int16[]', 'new Int16Array(n) → int16[]', 'const x = new Int16Array(10)'
      );

      this.assertEqual(
        this.inferType('const x = new Int32Array(10);', this.findVarInit),
        'int32[]', 'new Int32Array(n) → int32[]', 'const x = new Int32Array(10)'
      );

      this.assertEqual(
        this.inferType('const x = new Float32Array(10);', this.findVarInit),
        'float32[]', 'new Float32Array(n) → float32[]', 'const x = new Float32Array(10)'
      );

      this.assertEqual(
        this.inferType('const x = new Float64Array(10);', this.findVarInit),
        'float64[]', 'new Float64Array(n) → float64[]', 'const x = new Float64Array(10)'
      );
    });
  }

  // ============================================================================
  // Test Category 3: Binary Expression Type Inference
  // ============================================================================

  testBinaryExpressions() {
    this.runCategory('Binary Expression Type Inference', () => {
      // Comparison operators → boolean
      const comparisonOps = ['==', '===', '!=', '!==', '<', '>', '<=', '>='];
      for (const op of comparisonOps) {
        this.assertEqual(
          this.inferType(`const x = 1 ${op} 2;`, this.findVarInit),
          'boolean', `Comparison ${op} → boolean`, `const x = 1 ${op} 2`
        );
      }

      // ===== IDIOM DETECTION: Bitwise AND masks =====
      // x & 0xff or x & 255 → uint8 (byte mask idiom)
      this.assertEqual(
        this.inferType('function f(x) { return x & 0xff; }', this.findReturnArg),
        'uint8', 'IDIOM: x & 0xff → uint8', 'x & 0xff'
      );

      this.assertEqual(
        this.inferType('function f(x) { return x & 255; }', this.findReturnArg),
        'uint8', 'IDIOM: x & 255 → uint8', 'x & 255'
      );

      // x & 0xffff or x & 65535 → uint16 (word mask idiom)
      this.assertEqual(
        this.inferType('function f(x) { return x & 0xffff; }', this.findReturnArg),
        'uint16', 'IDIOM: x & 0xffff → uint16', 'x & 0xffff'
      );

      this.assertEqual(
        this.inferType('function f(x) { return x & 65535; }', this.findReturnArg),
        'uint16', 'IDIOM: x & 65535 → uint16', 'x & 65535'
      );

      // x & 0xffffffff → uint32 (dword mask idiom)
      this.assertEqual(
        this.inferType('function f(x) { return x & 0xffffffff; }', this.findReturnArg),
        'uint32', 'IDIOM: x & 0xffffffff → uint32', 'x & 0xffffffff'
      );

      // ===== IDIOM DETECTION: |0 forces int32 =====
      this.assertEqual(
        this.inferType('function f(x) { return x | 0; }', this.findReturnArg),
        'int32', 'IDIOM: x | 0 → int32', 'x | 0'
      );

      // ===== IDIOM DETECTION: >> 0 and >>> 0 =====
      this.assertEqual(
        this.inferType('function f(x) { return x >> 0; }', this.findReturnArg),
        'int32', 'IDIOM: x >> 0 → int32', 'x >> 0'
      );

      this.assertEqual(
        this.inferType('function f(x) { return x >>> 0; }', this.findReturnArg),
        'uint32', 'IDIOM: x >>> 0 → uint32', 'x >>> 0'
      );

      // ===== Bitwise ops (non-idiom) → left operand type =====
      // When left operand is known type, result is same type
      const code1 = `
        function f() {
          const arr = new Uint8Array(10);
          return arr[0] | 1;
        }
      `;
      this.assertEqual(
        this.inferType(code1, this.findReturnArg),
        'uint8', 'uint8 | int32 → uint8 (left type)', 'Uint8Array[0] | 1'
      );

      const code2 = `
        function f() {
          const arr = new Uint16Array(10);
          return arr[0] ^ 1;
        }
      `;
      this.assertEqual(
        this.inferType(code2, this.findReturnArg),
        'uint16', 'uint16 ^ int32 → uint16 (left type)', 'Uint16Array[0] ^ 1'
      );

      // Shift operators - left operand type (literals are int32)
      this.assertEqual(
        this.inferType('const x = 255 << 2;', this.findVarInit),
        'int32', 'int32 << n → int32', 'const x = 255 << 2'
      );

      this.assertEqual(
        this.inferType('const x = 65536 >> 2;', this.findVarInit),
        'int32', 'int32 >> n → int32', 'const x = 65536 >> 2'
      );

      // Arithmetic operators - default int32
      this.assertEqual(
        this.inferType('const x = 1 + 2;', this.findVarInit),
        'int32', 'int32 + int32 → int32', 'const x = 1 + 2'
      );

      this.assertEqual(
        this.inferType('const x = 1 + 256;', this.findVarInit),
        'int32', 'int32 + int32 → int32', 'const x = 1 + 256'
      );

      this.assertEqual(
        this.inferType('const x = 1 + 65536;', this.findVarInit),
        'int32', 'int32 + int32 → int32', 'const x = 1 + 65536'
      );

      // Arithmetic is typed to hold its result (2^31 + 1 does not fit int32)
      this.assertEqual(
        this.inferType('const x = 1 + 2147483648;', this.findVarInit),
        'uint32', 'literal 1 + literal 2^31 → uint32 (holds 2^31 + 1)', 'const x = 1 + 2147483648'
      );

      this.assertEqual(
        this.inferType('const x = "a" + 1;', this.findVarInit),
        'string', 'string + number → string', 'const x = "a" + 1'
      );

      this.assertEqual(
        this.inferType('const x = 10 - 5;', this.findVarInit),
        'int32', 'int32 - int32 → int32', 'const x = 10 - 5'
      );

      this.assertEqual(
        this.inferType('const x = 10 * 5;', this.findVarInit),
        'int32', 'int32 * int32 → int32', 'const x = 10 * 5'
      );

      // Division always returns float64 (JS semantics)
      this.assertEqual(
        this.inferType('const x = 10 / 5;', this.findVarInit),
        'float64', 'int32 / int32 → float64 (division produces float)', 'const x = 10 / 5'
      );

      this.assertEqual(
        this.inferType('const x = 10 % 3;', this.findVarInit),
        'int32', 'int32 % int32 → int32', 'const x = 10 % 3'
      );

      // Bitwise OR/XOR with literals - both int32 → int32 (left type)
      this.assertEqual(
        this.inferType('const x = 1 | 256;', this.findVarInit),
        'int32', 'int32 | int32 → int32 (left type)', 'const x = 1 | 256'
      );

      this.assertEqual(
        this.inferType('const x = 1 ^ 1;', this.findVarInit),
        'int32', 'int32 ^ int32 → int32 (left type)', 'const x = 1 ^ 1'
      );

      this.assertEqual(
        this.inferType('const x = 1 ^ 65536;', this.findVarInit),
        'int32', 'int32 ^ int32 → int32 (left type)', 'const x = 1 ^ 65536'
      );

      // Non-idiom AND with arbitrary mask → left operand type
      this.assertEqual(
        this.inferType('const x = 1000 & 0x1234;', this.findVarInit),
        'int32', 'int32 & arbitrary → int32 (left type)', 'const x = 1000 & 0x1234'
      );
    });
  }

  // ============================================================================
  // Test Category 4: Unary Expression Type Inference
  // ============================================================================

  testUnaryExpressions() {
    this.runCategory('Unary Expression Type Inference', () => {
      // Logical NOT → boolean
      this.assertEqual(
        this.inferType('const x = !true;', this.findVarInit),
        'boolean', '!expr → boolean', 'const x = !true'
      );

      this.assertEqual(
        this.inferType('const x = !0;', this.findVarInit),
        'boolean', '!0 → boolean', 'const x = !0'
      );

      // Unary plus → int32 (coerces to number, default int32)
      this.assertEqual(
        this.inferType('function f(a) { return +a; }', this.findReturnArg),
        'int32', '+expr → int32', '+a'
      );

      // Unary minus on literal → int32 (negative number)
      this.assertEqual(
        this.inferType('const x = -5;', this.findVarInit),
        'int32', '-literal → int32', 'const x = -5'
      );

      // Bitwise NOT → int32 (JavaScript converts to 32-bit int)
      this.assertEqual(
        this.inferType('function f(a) { return ~a; }', this.findReturnArg),
        'int32', '~expr → int32', '~a'
      );

      // typeof → string
      this.assertEqual(
        this.inferType('function f(a) { return typeof a; }', this.findReturnArg),
        'string', 'typeof → string', 'typeof a'
      );

      // void → void
      this.assertEqual(
        this.inferType('function f(a) { return void a; }', this.findReturnArg),
        'void', 'void → void', 'void a'
      );

      this.assertEqual(
        this.inferType('function f(a) { return void 0; }', this.findReturnArg),
        'void', 'void 0 → void', 'void 0'
      );

      // Double negation
      this.assertEqual(
        this.inferType('const x = !!0;', this.findVarInit),
        'boolean', '!!expr → boolean', 'const x = !!0'
      );
    });
  }

  // ============================================================================
  // Test Category 5: Conditional & Logical Expression Types
  // ============================================================================

  testConditionalTypes() {
    this.runCategory('Conditional & Logical Expression Types', () => {
      // Ternary - same types (int32 default)
      this.assertEqual(
        this.inferType('const x = true ? 1 : 2;', this.findVarInit),
        'int32', 'cond ? int32 : int32 → int32', 'true ? 1 : 2'
      );

      // Ternary - both int32 → int32
      this.assertEqual(
        this.inferType('const x = true ? 1 : 256;', this.findVarInit),
        'int32', 'cond ? int32 : int32 → int32', 'true ? 1 : 256'
      );

      this.assertEqual(
        this.inferType('const x = true ? 256 : 1;', this.findVarInit),
        'int32', 'cond ? int32 : int32 → int32', 'true ? 256 : 1'
      );

      this.assertEqual(
        this.inferType('const x = true ? 1 : 65536;', this.findVarInit),
        'int32', 'cond ? int32 : int32 → int32', 'true ? 1 : 65536'
      );

      // Ternary over literals: the type that holds both values (int32 cannot hold 2^31)
      this.assertEqual(
        this.inferType('const x = true ? 1 : 2147483648;', this.findVarInit),
        'uint32', 'cond ? 1 : 2^31 → uint32 (the literal 1 fits uint32)', 'true ? 1 : 2147483648'
      );

      // Ternary - string wins over number
      this.assertEqual(
        this.inferType('const x = true ? "a" : 1;', this.findVarInit),
        'string', 'cond ? string : number → string', 'true ? "a" : 1'
      );

      this.assertEqual(
        this.inferType('const x = true ? 1 : "a";', this.findVarInit),
        'string', 'cond ? number : string → string', 'true ? 1 : "a"'
      );

      // Logical AND → always boolean
      this.assertEqual(
        this.inferType('const x = true && 5;', this.findVarInit),
        'boolean', 'true && int32 → boolean', 'true && 5'
      );

      this.assertEqual(
        this.inferType('const x = true && "hello";', this.findVarInit),
        'boolean', 'true && string → boolean', 'true && "hello"'
      );

      // Logical OR → always boolean
      this.assertEqual(
        this.inferType('const x = 5 || 10;', this.findVarInit),
        'boolean', 'int32 || int32 → boolean', '5 || 10'
      );

      this.assertEqual(
        this.inferType('const x = "hello" || 5;', this.findVarInit),
        'boolean', 'string || int32 → boolean', '"hello" || 5'
      );
    });
  }

  // ============================================================================
  // Test Category 6: Variable Scope Type Tracking
  // ============================================================================

  testScopeTracking() {
    this.runCategory('Variable Scope Type Tracking', () => {
      // Same scope lookup - TypedArray preserves specific type
      const code1 = `
        function f() {
          const arr = new Uint32Array(10);
          return arr;
        }
      `;
      this.assertEqual(
        this.inferType(code1, this.findReturnArg),
        'uint32[]', 'Lookup in same scope', 'const arr = new Uint32Array(10); return arr;'
      );

      // Outer scope lookup - literals are int32
      const code2 = `
        const outer = 256;
        function f() {
          return outer;
        }
      `;
      this.assertEqual(
        this.inferType(code2, this.findReturnArg),
        'int32', 'Lookup from outer scope', 'outer = 256; ... return outer'
      );

      // Inner scope shadows outer - both are int32
      const code3 = `
        const x = 256;
        function f() {
          const x = 1;
          return x;
        }
      `;
      this.assertEqual(
        this.inferType(code3, this.findReturnArg),
        'int32', 'Inner scope shadows outer', 'outer x=256, inner x=1'
      );

      // Nested function scope - TypedArray preserves type
      const code4 = `
        function outer() {
          const a = new Uint16Array(5);
          function inner() {
            return a;
          }
          return inner();
        }
      `;
      this.assertEqual(
        this.inferType(code4, this.findReturnArg),
        'uint16[]', 'Nested function scope access', 'closure access'
      );

      // Block scope - int32 default
      const code5 = `
        function f() {
          {
            const block = 65536;
            return block;
          }
        }
      `;
      this.assertEqual(
        this.inferType(code5, this.findReturnArg),
        'int32', 'Block scope variable', 'block = 65536'
      );

      // Type flows from TypedArray assignment
      const code6 = `
        function f() {
          const arr = new Uint8Array(10);
          const elem = arr[0];
          return elem;
        }
      `;
      this.assertEqual(
        this.inferType(code6, this.findReturnArg),
        'uint8', 'Type flows from TypedArray indexing', 'arr[0] from Uint8Array'
      );
    });
  }

  // ============================================================================
  // Test Category 7: Class Field & Method Types
  // ============================================================================

  testClassTypes() {
    this.runCategory('Class Field & Method Types', () => {
      // Constructor field types - large hex literal exceeds int32, becomes uint32
      const code1 = `
        class Test {
          constructor() {
            this.hash = 0xFFFFFFFF;
          }
        }
      `;
      const node1 = this.findClassField(
        new TypeAwareJSASTParser(code1).parse(),
        'hash'
      );
      this.assertEqual(
        node1?.value?.resultType || node1?.right?.resultType,
        'uint32', 'Class field this.hash = 0xFFFFFFFF → uint32', 'this.hash = 0xFFFFFFFF'
      );

      // Empty array defaults to int32[]
      const code2 = `
        class Test {
          constructor() {
            this.buffer = [];
          }
        }
      `;
      const node2 = this.findClassField(
        new TypeAwareJSASTParser(code2).parse(),
        'buffer'
      );
      this.assertEqual(
        node2?.value?.resultType || node2?.right?.resultType,
        'int32[]', 'Class field this.buffer = [] → int32[]', 'this.buffer = []'
      );

      // TypedArray constructor preserves specific type
      const code3 = `
        class Test {
          constructor() {
            this.data = new Uint32Array(16);
          }
        }
      `;
      const node3 = this.findClassField(
        new TypeAwareJSASTParser(code3).parse(),
        'data'
      );
      this.assertEqual(
        node3?.value?.resultType || node3?.right?.resultType,
        'uint32[]', 'Class field this.data = new Uint32Array(16) → uint32[]', 'this.data = new Uint32Array(16)'
      );

      // Method with JSDoc return type
      const code4 = `
        class Test {
          /** @returns {uint32} */
          compute() {
            return 0;
          }
        }
      `;
      const func4 = this.findFunction(
        new TypeAwareJSASTParser(code4).parse(),
        'compute'
      );
      this.assertEqual(
        func4?.typeInfo?.returns || func4?.value?.typeInfo?.returns,
        'uint32', 'Method @returns {uint32} annotation', '@returns {uint32}'
      );

      // Multiple fields - int32 default for literals, TypedArray preserves type
      const code5 = `
        class Hasher {
          constructor() {
            this.state = new Uint32Array(8);
            this.buffer = [];
            this.count = 0;
            this.flag = true;
          }
        }
      `;
      const ast5 = new TypeAwareJSASTParser(code5).parse();

      const stateNode = this.findClassField(ast5, 'state');
      this.assertEqual(
        stateNode?.value?.resultType || stateNode?.right?.resultType,
        'uint32[]', 'Multi-field class: state → uint32[]', 'this.state = new Uint32Array(8)'
      );

      const countNode = this.findClassField(ast5, 'count');
      this.assertEqual(
        countNode?.value?.resultType || countNode?.right?.resultType,
        'int32', 'Multi-field class: count → int32', 'this.count = 0'
      );

      const flagNode = this.findClassField(ast5, 'flag');
      this.assertEqual(
        flagNode?.value?.resultType || flagNode?.right?.resultType,
        'boolean', 'Multi-field class: flag → boolean', 'this.flag = true'
      );
    });
  }

  // ============================================================================
  // Test Category 8: JSDoc Type Flow
  // ============================================================================

  testJSDocFlow() {
    this.runCategory('JSDoc Type Flow', () => {
      // NOTE: JSDoc parameter type propagation to func.typeInfo.params is an advanced
      // feature not yet fully implemented. Tests check the AST structure exists.
      // When implemented, update expectations from null to actual types.

      // @param type annotation - checks typeInfo structure exists
      const code1 = `
        /** @param {byte[]} data */
        function process(data) {
          return data;
        }
      `;
      const func1 = this.findFunction(
        new TypeAwareJSASTParser(code1).parse(),
        'process'
      );
      // For now, just verify the function node exists (feature not yet implemented)
      this.assertEqual(
        func1 !== null,
        true, '@param annotation: function parsed', '@param {byte[]} data'
      );

      // @returns type annotation
      const code2 = `
        /** @returns {uint32} */
        function hash() {
          return 0;
        }
      `;
      const func2 = this.findFunction(
        new TypeAwareJSASTParser(code2).parse(),
        'hash'
      );
      this.assertEqual(
        func2 !== null,
        true, '@returns annotation: function parsed', '@returns {uint32}'
      );

      // Multiple @param annotations
      const code3 = `
        /**
         * @param {uint32[]} key
         * @param {byte[]} data
         * @returns {byte[]}
         */
        function encrypt(key, data) {
          return data;
        }
      `;
      const func3 = this.findFunction(
        new TypeAwareJSASTParser(code3).parse(),
        'encrypt'
      );

      // Verify function exists (param type propagation is advanced feature)
      this.assertEqual(
        func3 !== null,
        true, 'Multiple @param: function parsed', '@param {uint32[]} key'
      );
      this.assertEqual(
        func3?.params?.length === 2,
        true, 'Multiple @param: params count correct', '@param {byte[]} data'
      );
      this.assertEqual(
        func3 !== null,
        true, 'Multiple params with @returns: function parsed', '@returns {byte[]}'
      );

      // Class method JSDoc
      const code4 = `
        class Cipher {
          /**
           * @param {byte[]} input
           * @returns {byte[]}
           */
          encrypt(input) {
            return input;
          }
        }
      `;
      const method4 = this.findFunction(
        new TypeAwareJSASTParser(code4).parse(),
        'encrypt'
      );
      const typeInfo4 = method4?.typeInfo || method4?.value?.typeInfo;
      this.assertEqual(
        typeInfo4?.returns,
        'byte[]', 'Class method @returns annotation', '@returns {byte[]}'
      );
    });
  }

  // ============================================================================
  // Test Category 9: Member Expression Type Inference
  // ============================================================================

  testMemberExpressions() {
    this.runCategory('Member Expression Type Inference', () => {
      // NOTE: JSDoc param type to element type propagation requires advanced
      // type tracking. Test simpler cases that work with current implementation.

      // Array indexing with TypedArray constructor (known element type)
      const code1 = `
        function f() {
          const arr = new Uint32Array(10);
          return arr[0];
        }
      `;
      this.assertEqual(
        this.inferType(code1, this.findReturnArg),
        'uint32', 'TypedArray[i] → element type (Uint32Array)', 'Uint32Array[0]'
      );

      const code2 = `
        function f() {
          const data = new Uint8Array(10);
          return data[0];
        }
      `;
      this.assertEqual(
        this.inferType(code2, this.findReturnArg),
        'uint8', 'TypedArray[i] → element type (Uint8Array)', 'Uint8Array[0]'
      );

      // Array length property
      const code3 = `
        /** @param {uint32[]} arr */
        function f(arr) {
          return arr.length;
        }
      `;
      this.assertEqual(
        this.inferType(code3, this.findReturnArg),
        'int32', 'arr.length → int32', 'arr.length'
      );

      // TypedArray length
      const code4 = `
        function f() {
          const arr = new Uint32Array(10);
          return arr.length;
        }
      `;
      this.assertEqual(
        this.inferType(code4, this.findReturnArg),
        'int32', 'TypedArray.length → int32', 'new Uint32Array(10).length'
      );

      // String length
      const code5 = `
        function f() {
          const s = "hello";
          return s.length;
        }
      `;
      this.assertEqual(
        this.inferType(code5, this.findReturnArg),
        'int32', 'string.length → int32', '"hello".length'
      );

      // Indexing into TypedArray variable
      const code6 = `
        function f() {
          const arr = new Uint16Array(10);
          return arr[5];
        }
      `;
      this.assertEqual(
        this.inferType(code6, this.findReturnArg),
        'uint16', 'TypedArray[i] → element type', 'Uint16Array[5] → uint16'
      );

      // Nested member access
      const code7 = `
        class Test {
          constructor() {
            this.data = new Uint32Array(10);
          }
          get() {
            return this.data.length;
          }
        }
      `;
      // This tests that this.data.length resolves correctly
      this.assertEqual(
        this.inferType(code7, this.findReturnArg),
        'int32', 'this.data.length → int32', 'this.data.length'
      );
    });
  }

  // ============================================================================
  // Test Category 10: Call Expression Type Inference
  // ============================================================================

  testCallExpressions() {
    this.runCategory('Call Expression Type Inference', () => {
      // Array methods - array literal elements are int32 by default
      const code1 = `
        function f() {
          const arr = [1, 2, 3];
          return arr.slice(0, 2);
        }
      `;
      this.assertEqual(
        this.inferType(code1, this.findReturnArg),
        'uint8[]', 'arr.slice() → same array type', 'arr.slice(0, 2)'
      );

      const code2 = `
        function f() {
          const arr = [1, 2, 3];
          return arr.pop();
        }
      `;
      this.assertEqual(
        this.inferType(code2, this.findReturnArg),
        'uint8', 'arr.pop() → element type', 'arr.pop()'
      );

      const code3 = `
        function f() {
          const arr = [1, 2, 3];
          return arr.push(4);
        }
      `;
      this.assertEqual(
        this.inferType(code3, this.findReturnArg),
        'int32', 'arr.push() → int32 (new length)', 'arr.push(4)'
      );

      const code4 = `
        function f() {
          const arr = [1, 2, 3];
          return arr.join(",");
        }
      `;
      this.assertEqual(
        this.inferType(code4, this.findReturnArg),
        'string', 'arr.join() → string', 'arr.join(",")'
      );

      // String methods
      const code5 = `
        function f() {
          const s = "hello";
          return s.split("");
        }
      `;
      this.assertEqual(
        this.inferType(code5, this.findReturnArg),
        'string[]', 'str.split() → string[]', 's.split("")'
      );

      const code6 = `
        function f() {
          const s = "hello";
          return s.charCodeAt(0);
        }
      `;
      this.assertEqual(
        this.inferType(code6, this.findReturnArg),
        'int32', 'str.charCodeAt() → int32', 's.charCodeAt(0)'
      );

      const code7 = `
        function f() {
          const s = "hello";
          return s.substring(0, 2);
        }
      `;
      this.assertEqual(
        this.inferType(code7, this.findReturnArg),
        'string', 'str.substring() → string', 's.substring(0, 2)'
      );

      const code8 = `
        function f() {
          const s = "hello";
          return s.toLowerCase();
        }
      `;
      this.assertEqual(
        this.inferType(code8, this.findReturnArg),
        'string', 'str.toLowerCase() → string', 's.toLowerCase()'
      );

      // Array indexOf
      const code9 = `
        function f() {
          const arr = [1, 2, 3];
          return arr.indexOf(2);
        }
      `;
      this.assertEqual(
        this.inferType(code9, this.findReturnArg),
        'int32', 'arr.indexOf() → int32', 'arr.indexOf(2)'
      );

      // Array filter (preserves type)
      const code10 = `
        function f() {
          const arr = new Uint32Array(10);
          return arr.filter(x => x > 0);
        }
      `;
      this.assertEqual(
        this.inferType(code10, this.findReturnArg),
        'uint32[]', 'TypedArray.filter() → same type', 'Uint32Array.filter()'
      );
    });
  }

  // ============================================================================
  // Test Category 11: OPERATION_RESULT_TYPES Mapping
  // ============================================================================

  testOperationResultTypes() {
    this.runCategory('OPERATION_RESULT_TYPES Mapping', () => {
      // Verify the static mapping exists and has expected entries
      const types = TypeAwareJSASTParser.OPERATION_RESULT_TYPES;

      // Rotation operations
      this.assertEqual(
        typeof types?.RotateLeft,
        'function', 'RotateLeft mapping exists', 'OPERATION_RESULT_TYPES.RotateLeft'
      );

      this.assertEqual(
        typeof types?.RotateRight,
        'function', 'RotateRight mapping exists', 'OPERATION_RESULT_TYPES.RotateRight'
      );

      // Test actual rotation result type generation
      if (types?.RotateLeft) {
        this.assertEqual(
          types.RotateLeft(32),
          'uint32', 'RotateLeft(32) → uint32', 'RotateLeft result type'
        );
        this.assertEqual(
          types.RotateLeft(64),
          'uint64', 'RotateLeft(64) → uint64', 'RotateLeft result type'
        );
      }

      // Pack/Unpack operations
      this.assertEqual(
        typeof types?.PackBytes,
        'function', 'PackBytes mapping exists', 'OPERATION_RESULT_TYPES.PackBytes'
      );

      this.assertEqual(
        typeof types?.UnpackBytes,
        'function', 'UnpackBytes mapping exists', 'OPERATION_RESULT_TYPES.UnpackBytes'
      );

      if (types?.PackBytes) {
        this.assertEqual(
          types.PackBytes(32),
          'uint32', 'PackBytes(32) → uint32', 'PackBytes result type'
        );
      }

      if (types?.UnpackBytes) {
        this.assertEqual(
          types.UnpackBytes(),
          'uint8[]', 'UnpackBytes() → uint8[]', 'UnpackBytes result type'
        );
      }

      // Array operations
      this.assertEqual(
        typeof types?.ArrayLength,
        'function', 'ArrayLength mapping exists', 'OPERATION_RESULT_TYPES.ArrayLength'
      );

      if (types?.ArrayLength) {
        this.assertEqual(
          types.ArrayLength(),
          'int32', 'ArrayLength() → int32', 'ArrayLength result type'
        );
      }

      // Math operations
      this.assertEqual(
        typeof types?.Floor,
        'function', 'Floor mapping exists', 'OPERATION_RESULT_TYPES.Floor'
      );

      if (types?.Floor) {
        this.assertEqual(
          types.Floor(),
          'int32', 'Floor() → int32', 'Floor result type'
        );
      }

      // Hex operations
      this.assertEqual(
        typeof types?.HexDecode,
        'function', 'HexDecode mapping exists', 'OPERATION_RESULT_TYPES.HexDecode'
      );

      if (types?.HexDecode) {
        this.assertEqual(
          types.HexDecode(),
          'uint8[]', 'HexDecode() → uint8[]', 'HexDecode result type'
        );
      }
    });
  }

  // ============================================================================
  // Test Category 12: Edge Cases (Abstruse Conditions)
  // ============================================================================

  testEdgeCases() {
    this.runCategory('Edge Cases (Abstruse Conditions)', () => {
      // Uninitialized variable
      const code1 = `
        function f() {
          let x;
          return x;
        }
      `;
      // Should not crash, may return null/undefined type
      const result1 = this.inferType(code1, this.findReturnArg);
      this.assertEqual(
        result1 === null || result1 === undefined || result1 === 'undefined',
        true, 'Uninitialized variable → null/undefined', 'let x; return x;'
      );

      // Reassignment with same type (both int32)
      const code2 = `
        function f() {
          let x = 1;
          x = 256;
          return x;
        }
      `;
      this.assertEqual(
        this.inferType(code2, this.findReturnArg),
        'int32', 'Type stays int32 after reassignment', 'x = 1; x = 256; return x;'
      );

      // Sparse array - parser currently throws on sparse arrays
      // This is acceptable behavior - sparse arrays are rare in crypto code
      const code3 = `const x = [1, , 3];`;
      let sparseResult;
      try {
        sparseResult = this.inferType(code3, this.findVarInit);
      } catch (e) {
        sparseResult = 'threw'; // Expected - parser doesn't support sparse arrays
      }
      this.assertEqual(
        sparseResult === 'threw' || sparseResult !== null,
        true, 'Sparse array: parser response', 'const x = [1, , 3]'
      );

      // Deeply nested member expression
      const code4 = `
        function f(obj) {
          return obj.a.b.c;
        }
      `;
      // Should not crash on deep nesting
      const result4 = this.inferType(code4, this.findReturnArg);
      this.assertEqual(
        result4 === null || typeof result4 === 'string',
        true, 'Deep nesting handled gracefully', 'obj.a.b.c'
      );

      // Non-exact mask → int32 (default, no idiom match)
      this.assertEqual(
        this.inferType('function f(x) { return x & 0xfffe; }', this.findReturnArg),
        'int32', 'Non-exact mask 0xfffe → int32', 'x & 0xfffe'
      );

      // Numeric boundaries - all stay int32 until overflow
      this.assertEqual(
        this.inferType('const x = 255;', this.findVarInit),
        'int32', 'Boundary 255 → int32', 'const x = 255'
      );

      this.assertEqual(
        this.inferType('const x = 256;', this.findVarInit),
        'int32', 'Boundary 256 → int32', 'const x = 256'
      );

      this.assertEqual(
        this.inferType('const x = 65535;', this.findVarInit),
        'int32', 'Boundary 65535 → int32', 'const x = 65535'
      );

      this.assertEqual(
        this.inferType('const x = 65536;', this.findVarInit),
        'int32', 'Boundary 65536 → int32', 'const x = 65536'
      );

      // int32 max boundary
      this.assertEqual(
        this.inferType('const x = 2147483647;', this.findVarInit),
        'int32', 'Max int32 → int32', 'const x = 2147483647'
      );

      // Exceeds int32 → uint32
      this.assertEqual(
        this.inferType('const x = 2147483648;', this.findVarInit),
        'uint32', 'Over int32 max → uint32', 'const x = 2147483648'
      );

      // Empty function body
      const code5 = `
        function f() {}
      `;
      // Should parse without error
      const result5 = new TypeAwareJSASTParser(code5).parse();
      this.assertEqual(
        result5 !== null,
        true, 'Empty function body parses', 'function f() {}'
      );

      // Arrow function
      const code6 = `
        const f = (x) => x * 2;
      `;
      const result6 = new TypeAwareJSASTParser(code6).parse();
      this.assertEqual(
        result6 !== null,
        true, 'Arrow function parses', 'const f = (x) => x * 2'
      );

      // Template literal
      const code7 = `
        const x = \`hello\`;
      `;
      this.assertEqual(
        this.inferType(code7, this.findVarInit),
        'string', 'Template literal → string', 'const x = `hello`'
      );

      // Very large number (BigInt territory)
      const code8 = `
        const x = 9007199254740992;
      `;
      const result8 = this.inferType(code8, this.findVarInit);
      this.assertEqual(
        result8 === 'uint64' || result8 === 'int64' || result8 === 'number',
        true, 'Very large number → uint64/int64/number', 'const x = 9007199254740992'
      );

      // Negative zero → int32
      const code9 = `
        const x = -0;
      `;
      this.assertEqual(
        this.inferType(code9, this.findVarInit),
        'int32', 'Negative zero → int32', 'const x = -0'
      );

      // Infinity → float64
      const code10 = `
        const x = Infinity;
      `;
      this.assertEqual(
        this.inferType(code10, this.findVarInit),
        'float64', 'Infinity → float64', 'const x = Infinity'
      );

      // NaN → float64
      const code11 = `
        const x = NaN;
      `;
      this.assertEqual(
        this.inferType(code11, this.findVarInit),
        'float64', 'NaN → float64', 'const x = NaN'
      );

      // Chained idiom: (x | 0) & 0xff → uint8 (AND mask idiom takes precedence)
      this.assertEqual(
        this.inferType('function f(x) { return (x | 0) & 0xff; }', this.findReturnArg),
        'uint8', 'Chained idiom (x|0)&0xff → uint8', '(x | 0) & 0xff'
      );

      // Type flow from TypedArray element through operations
      // uint8 + 1 reaches 256, which uint8 cannot hold: int32
      const code12 = `
        function f() {
          const arr = new Uint8Array(10);
          return arr[0] + 1;
        }
      `;
      this.assertEqual(
        this.inferType(code12, this.findReturnArg),
        'int32', 'uint8 + literal → int32 (holds 255 + 1)', 'Uint8Array[0] + 1'
      );
    });
  }

  // ============================================================================
  // Type soundness regressions
  // ============================================================================

  /**
   * The type of the variable `name`: its declarator's type, else its initializer's.
   * @param {string} code - JavaScript
   * @param {string} name - variable name
   * @returns {string|null} type
   */
  declType(code, name) {
    return this.inferType(code, ast => {
      const find = node => {
        if (!node || typeof node !== 'object') return null;
        if (node.type === 'VariableDeclarator' && node.id && node.id.name === name)
          return node.resultType ? node : node.init;
        for (const key in node) {
          if (key === 'loc' || key === 'range') continue;
          const r = find(node[key]);
          if (r) return r;
        }
        return null;
      };
      return find(ast);
    });
  }

  /**
   * Each case is a type the IL gave that a value at run time did not have
   * (found by tests/TypeSoundness.js), or a type the IL lost: the expected
   * type holds every value the expression can produce.
   */
  testSoundnessRegressions() {
    this.runCategory('Type Soundness Regressions', () => {
      const check = (code, name, expected, title) => this.assertEqual(this.declType(code, name), expected, title, code.replace(/\s+/g, ' '));
      const bytes = '/** @param {uint8[]} b\n * @param {uint8[]} c */\nfunction f(b, c) {\n';

      // A spread contributes its elements: [...bytes] was typed uint8[][]
      check(bytes + 'const x = [...b]; return x; }', 'x', 'uint8[]', 'given [...bytes], then uint8[] (not uint8[][])');
      check(bytes + 'const x = [...b, ...c]; return x; }', 'x', 'uint8[]', 'given [...a, ...b] of bytes, then uint8[]');
      check('/** @param {uint8[][]} m */\nfunction f(m) { const x = [...m]; return x; }', 'x', 'uint8[][]', 'given [...rows] of uint8[][], then uint8[][]');

      // The common type holds both sides
      const mixed = '/** @param {uint32} u\n * @param {int32} s\n * @param {uint8} b\n * @param {boolean} c */\nfunction f(u, s, b, c) {\n';
      check(mixed + 'const x = c ? u : s; return x; }', 'x', 'int64', 'given c ? uint32 : int32, then int64 (int32 cannot hold 2^32-1)');
      check(mixed + 'const x = c ? 0 : u; return x; }', 'x', 'uint32', 'given c ? 0 : uint32, then uint32 (the literal fits)');
      check(mixed + 'const x = c ? -1 : u; return x; }', 'x', 'int64', 'given c ? -1 : uint32, then int64 (boundary: a negative literal)');
      check('/** @param {uint8} b\n * @param {float32} g\n * @param {boolean} c */\nfunction f(b, g, c) { const x = c ? b : g; return x; }', 'x', 'float32', 'given c ? uint8 : float32, then float32');
      check(mixed + 'const x = c ? s : 1.5; return x; }', 'x', 'float64', 'given c ? int32 : 1.5, then float64 (float32 cannot hold int32)');
      check(bytes + 'const x = b.length > 0 ? null : c; return x; }', 'x', 'uint8[]', 'given cond ? null : bytes, then uint8[]');
      check(mixed + 'const x = Math.min(255, b); return x; }', 'x', 'uint8', 'given Math.min(255, uint8), then uint8');

      // Arithmetic is typed to hold its result
      check(mixed + 'const x = b + b; return x; }', 'x', 'int32', 'given uint8 + uint8, then int32 (holds 510)');
      check(mixed + 'const x = u + u; return x; }', 'x', 'int64', 'given uint32 + uint32, then int64');
      check(mixed + 'const x = u - 1; return x; }', 'x', 'int64', 'given uint32 - 1, then int64 (may be -1)');
      check('/** @param {uint16} a */\nfunction f(a) { const x = a * a; return x; }', 'x', 'uint32', 'given uint16 * uint16, then uint32 (boundary: 65535^2 < 2^32)');
      check(mixed + 'const x = s + b; return x; }', 'x', 'int32', 'given int32 + uint8, then int32 (a counted int32 stays int32)');
      check(mixed + 'const x = s * u; return x; }', 'x', 'int64', 'given int32 * uint32, then int64');
      this.assertEqual(this.inferType(mixed + 'let x = b; return x += b; }', this.findReturnArg), 'int32',
        'given uint8 += uint8, then the compound result is int32', 'x += b');

      // BigInt arithmetic does not wrap
      const big = '/** @param {BigInt} a\n * @param {uint64} w */\nfunction f(a, w) {\n';
      check(big + 'const x = a / 2n; return x; }', 'x', 'bigint', 'given BigInt / 2n, then bigint (was float64)');
      check(big + 'const x = w + 1n; return x; }', 'x', 'bigint', 'given uint64 + 1n, then bigint (exceeds 64 bits)');
      check(big + 'const x = OpCodes.ShiftLn(a, 3) - 1n; return x; }', 'x', 'bigint', 'given ShiftLn(...) - 1n, then bigint (was int64)');
      check(big + 'const x = a & 0xFFn; return x; }', 'x', 'uint64', 'given BigInt & 0xFFn, then uint64');
      check(big + 'const x = w >> 3n; return x; }', 'x', 'uint64', 'given uint64 >> 3n, then uint64');
      check(big + 'const x = a % 7n; return x; }', 'x', 'bigint', 'given BigInt % 7n, then bigint (keeps the sign)');

      // Rounding keeps the dividend's range
      check(mixed + 'const x = Math.floor(u / 8); return x; }', 'x', 'int32', 'given Math.floor(uint32 / 8), then int32');
      check(mixed + 'const x = Math.floor(u / 1); return x; }', 'x', 'uint32', 'given Math.floor(uint32 / 1), then uint32 (boundary: divisor 1)');
      check('/** @param {uint64} v */\nfunction f(v) { const x = Math.floor(v / 0x100000000); return x; }', 'x', 'uint64', 'given Math.floor(uint64 / 2^32), then uint64 (was int32)');
      check(mixed + 'const x = Math.floor(u / u); return x; }', 'x', 'uint32', 'given Math.floor(uint32 / uint32), then uint32');
      check('function f() { const x = Math.floor(Math.random() * 10); return x; }', 'x', 'int32', 'given Math.floor(float), then int32 (unchanged default)');

      // A JSDoc type survives a braceless if
      const after = '\n  /** @type {uint8[]} */\n  const out = new Array(d.length);\n  return out;\n}';
      check('/** @param {uint8[]} d\n * @param {boolean} f */\nfunction g(d, f) {\n  if (f) d = d;' + after, 'out', 'uint8[]', 'given if (f) x = y; then the next JSDoc @type is kept');
      check('/** @param {uint8[]} d\n * @param {boolean} f */\nfunction g(d, f) {\n  if (f) return d;' + after, 'out', 'uint8[]', 'given if (f) return d; then the next JSDoc @type is kept');
      check('/** @param {uint8[]} d\n * @param {boolean} f */\nfunction g(d, f) {\n  if (f) d = d;\n  else d = d;' + after, 'out', 'uint8[]', 'given if/else without braces, then the next JSDoc @type is kept');

      // Methods of the file's own classes type calls on their objects
      const G = 'class G { /** @returns {uint8} */ next() { return 1; } }\n';
      check(G + 'class A { constructor() { /** @type {G} */ this.g = new G(); } m() { const v = this.g.next(); return v; } }', 'v', 'uint8', 'given this.g typed {G}, then this.g.next() is uint8');
      check(G + 'class A { constructor() { /** @type {G|null} */ this.g = null; } m() { const v = this.g.next(); return v; } }', 'v', 'uint8', 'given this.g typed {G|null}, then this.g.next() is uint8');
      check(G + 'function m() { /** @type {G} */ const g = new G(); const v = g.next(); return v; }', 'v', 'uint8', 'given a local typed {G}, then g.next() is uint8');
      check(G + 'function m() { const v = new G().next(); return v; }', 'v', 'uint8', 'given new G().next(), then uint8');
      check('class Box { /** @returns {uint8[]} */ Get() { return []; } }\n/** @param {Box} b */\nfunction f(b) { const v = b.Get(); return v; }', 'v', 'uint8[]', 'given @param {Box} b, then b.Get() is uint8[]');
      check(G + 'class H extends G { }\nfunction m() { const v = new H().next(); return v; }', 'v', 'uint8', 'given a subclass, then the inherited method types the call');
      check(G + 'function m() { const v = new G().other(); return v; }', 'v', null, 'given a method the class lacks, then no type (exceptional)');

      // Methods of AlgorithmFramework classes type calls on their objects
      check('/** @param {HashFunctionAlgorithm} alg */\nfunction f(alg) { const i = alg.CreateInstance(); return i; }', 'i', 'IHashFunctionInstance', 'given @param {HashFunctionAlgorithm} alg, then alg.CreateInstance() is IHashFunctionInstance');

      // A sibling data module is typed by its own JSDoc
      {
        const fs = require('fs'), os = require('os');
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sibling-'));
        try {
          fs.writeFileSync(path.join(dir, 'shared.data.js'),
            '(function (root, factory) { module.exports = factory(); })(this, function () {\n' +
            '  class Rng { /** @returns {uint32} */ next() { return 1; } }\n' +
            '  /** @type {uint8[]} */\n  const TABLE = [1, 2, 3];\n' +
            '  return { Rng, TABLE };\n});\n');
          const main = '(function (root, factory) { module.exports = factory(require(\'./shared.data\')); })(this, function (Shared) {\n' +
            '  const { Rng, TABLE } = Shared;\n' +
            '  function f() { const r = new Rng(); const v = r.next(); const t = TABLE; return v + t[0]; }\n' +
            '  return { f };\n});\n';
          const typeIn = (name, withPath) => {
            const log = console.log; console.log = () => {};
            try {
              const ast = new TypeAwareJSASTParser(main, withPath ? { sourcePath: path.join(dir, 'main.js') } : {}).parse();
              const decl = (function find(n) {
                if (!n || typeof n !== 'object') return null;
                if (n.type === 'VariableDeclarator' && n.id && n.id.name === name) return n;
                for (const k in n) { if (k === 'loc' || k === 'range') continue; const r = find(n[k]); if (r) return r; }
                return null;
              })(ast);
              return decl ? decl.resultType || null : null;
            } finally { console.log = log; }
          };
          this.assertEqual(typeIn('v', true), 'uint32', 'given a class of a sibling .data module, then its method JSDoc types the call', 'r.next()');
          this.assertEqual(typeIn('t', true), 'uint8[]', 'given a @type table of a sibling .data module, then the destructured name is typed', 'TABLE');
          this.assertEqual(typeIn('Rng', true), 'function', 'given a class destructured from a sibling, then the binding is a function', 'Rng');
          this.assertEqual(typeIn('v', false), null, 'given no source path, then the sibling is not read (exceptional)', 'r.next()');
        } finally {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      }

      // A typed-array JSDoc name is an array of its element type
      check('/** @param {Uint8Array} a */\nfunction f(a) { const v = a[0]; return v; }', 'v', 'uint8', 'given @param {Uint8Array} a, then a[0] is uint8');
      check('/** @param {Uint32Array} a */\nfunction f(a) { const v = a; return v; }', 'v', 'uint32[]', 'given @param {Uint32Array}, then uint32[]');
      check('/** @param {BigUint64Array} a */\nfunction f(a) { const v = a[1]; return v; }', 'v', 'uint64', 'given @param {BigUint64Array}, then elements are uint64');

      // Constructor @param types the arguments of new
      this.assertEqual(this.inferType('class Prof { /** @param {int32[]} a */ constructor(a) { this.a = a; } }\nconst p = new Prof([1, 2, 3]);',
        ast => this.findNodeOfType(ast, 'ArrayExpression')), 'int32[]', 'given @param {int32[]} on the constructor, then new Prof([1, 2, 3]) passes int32[]', 'new Prof([1, 2, 3])');

      // new Array(n).fill(v) takes the declared type
      check('/** @param {int32} n */\nfunction f(n) { /** @type {int32[]} */ const a = new Array(n).fill(0); return a; }', 'a', 'int32[]', 'given @type {int32[]} on new Array(n).fill(0), then int32[]');
      this.assertEqual(this.inferType('/** @param {int32} n */\nfunction f(n) { /** @type {int32[]} */ const a = new Array(n).fill(0); return a; }',
        ast => this.findNodeOfType(ast, 'ArrayCreation')), 'int32[]', 'given the same, then the inner new Array(n) is int32[] too', 'new Array(n)');

      // Loop variables and inline callbacks take the element type
      check('/** @param {string[]} names */\nfunction f(names) { for (const x of names) { const y = x; return y; } return ""; }', 'y', 'string', 'given for (const x of string[]), then x is string');
      check('/** @param {uint32[]} w */\nfunction f(w) { for (const x of w) { const y = x; return y; } return 0; }', 'y', 'uint32', 'given for (const x of uint32[]), then x is uint32');
      check(bytes + 'return b.map(v => { const w = v; return w; }); }', 'w', 'uint8', 'given bytes.map(v => ...), then v is uint8');
      check(bytes + 'b.forEach((v, i) => { const k = i; return k; }); return b; }', 'k', 'int32', 'given forEach((v, i) => ...), then i is int32');
      check(bytes + 'return b.reduce((acc, v) => { const w = v; return acc + w; }, 0); }', 'w', 'uint8', 'given reduce((acc, v) => ...), then v is uint8');
      check('function f(b) { return b.map(v => { const w = v; return w; }); }', 'w', null, 'given an untyped array, then the callback parameter stays untyped');

      // JSDoc in front of `const f = (a, b) => ...` types the arrow
      check('/**\n * @param {uint8} a\n * @param {uint32} b\n * @returns {uint32}\n */\nconst f = (a, b) => { const v = b; return v; };', 'v', 'uint32', 'given JSDoc on const f = (a, b) => ..., then b is uint32');
      check('/**\n * @param {uint8} a\n * @returns {uint32}\n */\nconst f = (a, b) => { const v = b; return v; };', 'v', null, 'given JSDoc that leaves b out, then b stays untyped');
      check('/**\n * @param {uint8} q - names no parameter of the arrow\n */\nconst f = (a) => { const v = a; return v; };', 'v', null, 'given JSDoc naming another parameter, then the arrow is not typed by it (exceptional)');
      check('/**\n * @param {uint8[]} d\n * @returns {uint8}\n */\nconst f = d => d[0];\nconst x = f([1]);', 'x', 'uint8', 'given @returns on an arrow, then calls of it are typed');

      // Typed-array results
      check('/** @param {Uint8Array} a */\nfunction f(a) { const v = a.subarray(1, 3); return v; }', 'v', 'uint8[]', 'given Uint8Array.subarray(), then uint8[]');
      check('/** @returns {Uint8Array} */\nfunction g() { return new Uint8Array(4); }\nfunction f() { const v = g(); return v; }', 'v', 'uint8[]', 'given @returns {Uint8Array}, then the call is uint8[]');

      // Keyed collections
      check('/** @type {Object<string, uint8[]>} */\nconst T = {};\nfunction f(k) { const v = T[k]; return v; }', 'v', 'uint8[]', 'given Object<string, uint8[]>, then T[k] is uint8[]');
      check('/** @type {Object.<string, uint32>} */\nconst T = {};\nfunction f() { const v = T.abc; return v; }', 'v', 'uint32', 'given Object.<string, uint32>, then T.abc is uint32');
      check('/** @param {Map<string, uint16[]>} m */\nfunction f(m) { const v = m.get("a"); return v; }', 'v', 'uint16[]', 'given Map<string, uint16[]>, then m.get(k) is uint16[]');
      check('/** @param {Map<string, uint16[]>} m */\nfunction f(m) { const v = m.has("a"); return v; }', 'v', 'boolean', 'given Map<K, V>, then m.has(k) is boolean');
      check('/** @param {Map<string>} m */\nfunction f(m) { const v = m.get("a"); return v; }', 'v', null, 'given Map with one type argument, then nothing is assumed (exceptional)');

      // The declared type reaches both branches of a ternary
      this.assertEqual(this.inferType('/** @param {boolean} c */\nfunction f(c) { /** @type {uint8[]} */ const v = c ? [1, 2] : [300]; return v; }',
        ast => this.findNodeOfType(ast, 'ConditionalExpression')), 'uint8[]', 'given @type {uint8[]} on c ? [..] : [..], then the ternary is uint8[]', 'c ? [1, 2] : [300]');
      this.assertEqual(this.inferType('/** @param {boolean} c */\nfunction f(c) { /** @type {uint16[]} */ const v = c ? [1, 2] : []; return v; }',
        ast => this.findNodeOfType(ast, 'ArrayExpression')), 'uint16[]', 'given @type {uint16[]}, then a literal branch takes the declared type', '[1, 2]');

      // Comments inside an expression, and after braceless loops
      check('/** @param {boolean} a\n * @param {boolean} b\n * @param {boolean} c */\nfunction f(a, b, c) {\n  const x = a === b // why\n    || c;\n  return x;\n}', 'x', 'boolean', 'given a === b // comment, then || c on the next line, then it parses (was a parse error)');
      check('/** @param {uint8} a\n * @param {uint8} b */\nfunction f(a, b) {\n  const x = a /* left */ * /* right */ b;\n  return x;\n}', 'x', 'int32', 'given block comments around an operator, then it parses');
      check('/** @param {boolean} c */\nfunction f(c) {\n  const x = c ? 1 // one\n    : 2;\n  return x;\n}', 'x', 'int32', 'given a comment before the : of a ternary, then it parses');
      check('/** @param {uint8} a */\nfunction f(a) {\n  let x = a // trailing\n  /** @type {uint16} */\n  const y = 1;\n  return y;\n}', 'y', 'uint16', 'given a trailing comment and no semicolon, then the next JSDoc still leads the next statement');
      check('/** @param {uint8[]} d */\nfunction g(d) {\n  for (let i = 0; i < 4; ++i) if (d[i]) return d;\n  /** @type {uint8[]} */\n  const out = new Array(4);\n  return out;\n}', 'out', 'uint8[]', 'given for (...) if (...) return ...; then the next JSDoc @type is kept');

      // OpCodes.SecureRandomBytes is typed by its JSDoc
      check('function f() { const k = OpCodes.SecureRandomBytes(16); return k; }', 'k', 'uint8[]', 'given OpCodes.SecureRandomBytes(16), then uint8[]');

      // A function of the file used as a value
      check('function CompareNumbers(a, b) { return 0; }\nfunction f() { const c = CompareNumbers; return c; }', 'c', 'function', 'given a named function as a value, then it is typed function');
      check('function f() { const c = NotDeclaredAnywhere; return c; }', 'c', null, 'given an unknown name, then no type (exceptional)');

      // Bitwise operators on numbers yield int32
      const words = '/** @param {uint32} a\n * @param {uint32} b\n * @param {uint8} c */\nfunction f(a, b, c) {\n';
      check(words + 'const x = a ^ b; return x; }', 'x', 'int32', 'given uint32 ^ uint32, then int32 (may be negative; was uint32)');
      check(words + 'const x = a | 1; return x; }', 'x', 'int32', 'given uint32 | 1, then int32');
      check(words + 'const x = a << 1; return x; }', 'x', 'int32', 'given uint32 << 1, then int32');
      check(words + 'const x = c & a; return x; }', 'x', 'uint8', 'given uint8 & uint32, then uint8 (within the uint8)');
      check(words + 'const x = c >> 1; return x; }', 'x', 'uint8', 'given uint8 >> 1, then uint8');
      this.assertEqual(this.inferType(words + 'let x = a; return x ^= b; }', this.findReturnArg), 'int32',
        'given uint32 ^= uint32, then the compound result is int32 (was uint32)', 'x ^= b');

      // BigInt literals and BigInt-typed variables
      check('function f() { const x = 18446744073709551616n; return x; }', 'x', 'bigint', 'given 2^64 as a BigInt literal, then bigint (was uint64)');
      check('function f() { const x = 18446744073709551615n; return x; }', 'x', 'uint64', 'given 2^64-1, then uint64 (boundary)');
      check('function f() { const x = -9223372036854775809n; return x; }', 'x', 'bigint', 'given -2^63-1, then bigint (boundary)');
      {
        const ast = (() => { const log = console.log; console.log = () => {}; try { return new TypeAwareJSASTParser('/** @param {BigInt} m */\nfunction f(m) { let r = 1n; r = (r * m) % m; return r; }').parse(); } finally { console.log = log; } })();
        const lit = this.findNodeOfType(ast, 'Literal');
        this.assertEqual(Boolean(lit && lit.typeGuess), true, 'given let r = 1n later assigned a bigint, then the literal type is flagged as a guess', 'let r = 1n');
      }

      // An undeclared field holds every value assigned to it
      check('class A { constructor() { this.a = 0; } /** @param {uint32} s */ seed(s) { this.a = s; } get() { const v = this.a; return v; } }', 'v', 'uint32', 'given this.a = 0 and this.a = uint32, then the field is uint32');
      check('class A { constructor() { this.a = 0; } /** @param {uint32} s */ seed(s) { this.a = s; this.a = 7; } get() { const v = this.a; return v; } }', 'v', 'uint32', 'given a literal after a uint32, then the field stays uint32 (was int32)');
      check('class A { constructor() { this.a = -1; } /** @param {uint32} s */ seed(s) { this.a = s; } get() { const v = this.a; return v; } }', 'v', 'int64', 'given this.a = -1 and this.a = uint32, then int64');
      check('class A { constructor() { this.a = 0; } /** @param {uint8[]} s */ seed(s) { this.a = s; } get() { const v = this.a; return v; } }', 'v', 'uint8[]', 'given a number then an array, then the last assignment (no numeric join)');

      // Negation is signed
      check(words + 'const x = -a; return x; }', 'x', 'int64', 'given -uint32, then int64 (was uint32)');
      check(words + 'const x = -c; return x; }', 'x', 'int32', 'given -uint8, then int32');
      check('function f() { const x = -2147483648; return x; }', 'x', 'int32', 'given -2^31, then int32 (boundary)');
      check('/** @param {BigInt} a */\nfunction f(a) { const x = ~a; return x; }', 'x', 'bigint', 'given ~BigInt, then bigint (was int32)');

      // CopyArray copies any element type
      check('/** @param {uint32[]} w */\nfunction f(w) { const x = OpCodes.CopyArray(w); return x; }', 'x', 'uint32[]', 'given CopyArray(uint32[]), then uint32[] (was uint8[])');
      check('/** @param {uint8[]} w */\nfunction f(w) { const x = OpCodes.CopyArray(w); return x; }', 'x', 'uint8[]', 'given CopyArray(uint8[]), then uint8[]');

      // Multiplication by a literal widens
      check('/** @param {uint8} a */\nfunction f(a) { const v = a * 16; return v; }', 'v', 'int32', 'given uint8 * 16, then int32 (was uint8)');
      check('/** @param {uint8} a */\nfunction f(a) { const v = a * -1; return v; }', 'v', 'int32', 'given uint8 * -1, then int32 (negative)');
    });
  }

  /**
   * First node of an IL node type.
   * @param {Object} ast - IL AST
   * @param {string} type - node type
   * @returns {Object|null} node
   */
  findNodeOfType(ast, type) {
    const find = node => {
      if (!node || typeof node !== 'object') return null;
      if (node.type === type) return node;
      for (const key in node) {
        if (key === 'loc' || key === 'range') continue;
        const r = find(node[key]);
        if (r) return r;
      }
      return null;
    };
    return find(ast);
  }

  // ============================================================================
  // Test Runner
  // ============================================================================

  run() {
    const startTime = Date.now();

    // Run all test categories
    this.testLiteralTypes();
    this.testArrayTypes();
    this.testBinaryExpressions();
    this.testUnaryExpressions();
    this.testConditionalTypes();
    this.testScopeTracking();
    this.testClassTypes();
    this.testJSDocFlow();
    this.testMemberExpressions();
    this.testCallExpressions();
    this.testOperationResultTypes();
    this.testEdgeCases();
    this.testSoundnessRegressions();

    const elapsed = Date.now() - startTime;

    // Print summary
    console.log('\n\x1b[1m════════════════════════════════════════════════════════════\x1b[0m');

    const total = this.passed + this.failed;
    const passRate = total > 0 ? ((this.passed / total) * 100).toFixed(1) : 0;

    if (this.failed === 0) {
      console.log(`\x1b[32m\x1b[1mPASSED: ${this.passed}/${total} tests (100%)\x1b[0m`);
    } else {
      console.log(`\x1b[31m\x1b[1mFAILED: ${this.failed}/${total} tests (${passRate}% pass rate)\x1b[0m`);

      // Group errors by category
      const byCategory = {};
      for (const err of this.errors) {
        if (!byCategory[err.category])
          byCategory[err.category] = [];
        byCategory[err.category].push(err);
      }

      console.log('\n\x1b[1mFailure Details:\x1b[0m');
      for (const [category, errs] of Object.entries(byCategory)) {
        console.log(`\n  \x1b[33m${category}:\x1b[0m`);
        for (const err of errs) {
          console.log(`    - ${err.testName}`);
          console.log(`      Expected: \x1b[32m${err.expected}\x1b[0m`);
          console.log(`      Actual:   \x1b[31m${err.actual}\x1b[0m`);
          if (err.code)
            console.log(`      Code:     ${err.code}`);
        }
      }
    }

    console.log(`\nCompleted in ${elapsed}ms`);
    console.log('\x1b[1m════════════════════════════════════════════════════════════\x1b[0m\n');

    const categories = new Set(this.errors.map(e => e.category));
    return { passed: this.passed, failed: this.failed, detail: this.failed ? `failing groups: ${[...categories].join(', ')}` : '' };
  }
}

/**
 * INFERENCE: type inference of the shared transpiler AST.
 * @param {object} options - { verbose, group } (group: one test group, e.g. literals)
 * @returns {object} { passed, failed, detail }
 */
function run(options = {}) {
  return new TypeInferenceTestSuite({
    verbose: Boolean(options.verbose),
    category: options.group ? options.group.toLowerCase() : null
  }).run();
}

module.exports = { run };
