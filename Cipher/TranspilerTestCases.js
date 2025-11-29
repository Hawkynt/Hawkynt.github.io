/**
 * TranspilerTestCases.js - Test cases for JavaScript to C# transpiler
 * This file contains all problematic constructs identified during transpilation.
 * Run: node transpile.js TranspilerTestCases.js "C#" > generated/TranspilerTestCases.cs
 * Build: cd generated && dotnet build
 */

// ========================[ NORMAL FUNCTION ]========================
  /**
   * Function returning object with named properties (should become C# tuple)
   * @param {float32} a - Input value
   * @param {uint16} b - Input value
   * @returns {float32} Result
   */
function StaticOutSideScope(a, b){
  return a + b
}


const TranspilerTestCases = {

  // ========================[ TUPLE RETURN TYPES ]========================

  /**
   * Function returning object with named properties (should become C# tuple)
   * @param {float64} value - Input value
   * @returns {(high32: uint32, low32: uint32)} Tuple with high and low parts
   */
  Split64: function(value) {
    const low32 = value & 0xFFFFFFFF;
    const high32 = Math.floor(value / 0x100000000);
    return { high32: high32, low32: low32 };
  },

  /**
   * Function using tuple return value
   * @param {float64} num - Number to convert
   * @returns {uint32[]} Array [high32, low32]
   */
  FromNumber: function(num) {
    const split = TranspilerTestCases.Split64(num);
    return [split.high32, split.low32];
  },

  // ========================[ NEW ARRAY PATTERNS ]========================

  /**
   * new Array(n) with return type inference
   * @param {uint32[]} a - First value
   * @param {uint32[]} b - Second value
   * @returns {uint32[]} Result array
   */
  Add: function(a, b) {
    let carry = 0;
    const result = new Array(4);
    for (let i = 3; i >= 0; --i) {
      const sum = a[i] + b[i] + carry;
      result[i] = sum & 0xFFFFFFFF;
      carry = sum > 0xFFFFFFFF ? 1 : 0;
    }
    return result;
  },

  /**
   * new Array(n).fill(0) with assignment target type
   * @param {ushort[]} words16 - Input array
   * @returns {uint32[]} Packed result
   */
  FromUInt16: function(words16) {
    if (words16.length < 4) {
      const padded = new Array(4).fill(0);
      for (let i = 0; i < words16.length; ++i) {
        padded[4 - words16.length + i] = words16[i];
      }
      words16 = padded;
    }
    return [(words16[0] << 16) | words16[1], (words16[2] << 16) | words16[3]];
  },

  // ========================[ JAGGED ARRAYS (2D) ]========================

  /**
   * Function returning jagged array (array of arrays)
   * @param {uint32[]} a - 256-bit value as 8 uint32s
   * @returns {uint32[][]} Array of 4 UInt64 values [[h,l], [h,l], [h,l], [h,l]]
   */
  ToUInt64: function(a) {
    return [
      [a[0], a[1]], [a[2], a[3]], [a[4], a[5]], [a[6], a[7]]
    ];
  },

  /**
   * Function with jagged array parameter and padding
   * @param {uint32[][]} words64 - Array of 64-bit values
   * @returns {uint32[]} Flattened 256-bit value
   */
  FromUInt64: function(words64) {
    if (words64.length < 4) {
      const padded = new Array(4);
      for (let i = 0; i < 4; ++i) {
        padded[i] = i < 4 - words64.length ? [0, 0] : words64[i - (4 - words64.length)];
      }
      words64 = padded;
    }
    return [words64[0][0], words64[0][1], words64[1][0], words64[1][1],
            words64[2][0], words64[2][1], words64[3][0], words64[3][1]];
  },

  // ========================[ TYPE NARROWING ]========================

  /**
   * Operations requiring type narrowing casts
   * @param {byte[]} input - Input bytes
   * @returns {byte[]} Output bytes
   */
  ByteOperations: function(input) {
    const result = new Array(input.length);
    for (let i = 0; i < input.length; ++i) {
      result[i] = (input[i] ^ 0xFF) & 0xFF;
    }
    return result;
  },

  /**
   * Unsigned right shift operations
   * @param {uint32} value - Input value
   * @param {int32} shift - Shift amount
   * @returns {uint32} Shifted value
   */
  UnsignedShift: function(value, shift) {
    let result = value;
    result >>>= shift;
    return result >>> 0;
  },

  // ========================[ COLLECTION OPERATIONS ]========================

  /**
   * Stack-like operations (uses List internally)
   * @param {uint32[]} initial - Initial values
   * @returns {uint32[]} Result
   */
  StackOperations: function(initial) {
    const stack = [];
    for (let i = 0; i < initial.length; ++i) {
      stack.push(initial[i]);
    }
    const result = [];
    while (stack.length > 0) {
      result.push(stack.pop());
    }
    return result;
  },

  // ========================[ MEMBER ACCESS PATTERNS ]========================

  /**
   * Array length vs List.Count
   * @param {uint32[]} arr - Array parameter
   * @returns {int32} Length
   */
  GetLength: function(arr) {
    return arr.length;
  },

  /**
   * Slice operations
   * @param {byte[]} data - Input data
   * @param {int32} start - Start index
   * @returns {byte[]} Sliced data
   */
  SliceArray: function(data, start) {
    // .slice() with no args -> copy
    const copy = data.slice();
    // .slice(n) -> skip n
    const skipped = data.slice(start);
    return copy.concat(skipped);
  },

  // ========================[ CONDITIONAL TYPE HANDLING ]========================

  /**
   * Ternary with different branch types
   * @param {boolean} condition - Condition
   * @param {uint32} a - True value
   * @param {uint32} b - False value
   * @returns {uint32} Selected value
   */
  ConditionalSelect: function(condition, a, b) {
    return condition ? a : b;
  },

  /**
   * Typeof checks
   * @param {object} value - Value to check
   * @returns {boolean} Is string
   */
  IsString: function(value) {
    return typeof value === 'string';
  },

  // ========================[ BITWISE OPERATIONS ]========================

  /**
   * 32-bit rotation operations
   * @param {uint32} value - Value to rotate
   * @param {int32} n - Rotation amount
   * @returns {uint32} Rotated value
   */
  RotateLeft32: function(value, n) {
    n = n & 31;
    return ((value << n) | (value >>> (32 - n))) >>> 0;
  },

  /**
   * XOR operations on arrays
   * @param {byte[]} a - First array
   * @param {byte[]} b - Second array
   * @returns {byte[]} XOR result
   */
  XorArrays: function(a, b) {
    const result = new Array(a.length);
    for (let i = 0; i < a.length; ++i) {
      result[i] = a[i] ^ b[i];
    }
    return result;
  },

  // ========================[ LIST TYPE NARROWING ]========================

  /**
   * List.Add with type narrowing (uint & 255 -> byte)
   * @param {uint32[]} words - Input words
   * @returns {byte[]} Byte array
   */
  ListAddNarrowing: function(words) {
    const bytes = [];
    for (let i = 0; i < words.length; ++i) {
      const word = words[i];
      bytes.push((word >> 24) & 255);
      bytes.push((word >> 16) & 255);
      bytes.push((word >> 8) & 255);
      bytes.push(word & 255);
    }
    return bytes;
  },

  /**
   * Ternary with array element type mismatch
   * @param {byte[]} bytes - Input bytes
   * @param {int32} start - Start index
   * @returns {uint32[]} Extracted values
   */
  TernaryTypeMismatch: function(bytes, start) {
    const values = [];
    const v0 = start < bytes.length ? bytes[start] : 0;
    const v1 = start + 1 < bytes.length ? bytes[start + 1] : 0;
    values.push(v0 << 8 | v1);
    return values;
  },

  /**
   * Helper function expecting byte parameters
   * @param {byte} b0 - First byte
   * @param {byte} b1 - Second byte
   * @returns {uint32} Packed value
   */
  PackBytes: function(b0, b1) {
    return (b0 << 8) | b1;
  },

  /**
   * Calling function with wrong argument types
   * @param {byte[]} data - Input data
   * @returns {uint32} Result
   */
  FunctionCallTypeMismatch: function(data) {
    const a = data[0];
    const b = data[1];
    return TranspilerTestCases.PackBytes(a, b);
  },

  // ========================[ LITERAL TYPE CONVERSIONS ]========================

  /**
   * Assignment with literal int to uint conversion
   * @returns {uint32} Result
   */
  LiteralIntToUint: function() {
    const a = 0;  // literal 0 as int
    const b = 1;  // literal 1 as int
    return a + b; // should be uint32
  },

  /**
   * Assignment with literal long to ulong conversion
   * @returns {ulong} Result
   */
  LiteralLongToUlong: function() {
    const a = 0x100000000;  // literal exceeding 32-bit, becomes long
    return a;  // should be ulong
  },

  /**
   * Function call with shifted literal argument
   * @param {byte} b0 - First byte
   * @param {byte} b1 - Second byte
   * @param {byte} b2 - Third byte
   * @param {byte} b3 - Fourth byte
   * @returns {uint32} Packed value
   */
  PackFourBytes: function(b0, b1, b2, b3) {
    return (b0 << 24) | (b1 << 16) | (b2 << 8) | b3;
  },

  /**
   * Calling function with shifted literals
   * @param {uint32} value - Input value
   * @returns {uint32} Result
   */
  ShiftedLiteralArgs: function(value) {
    const b0 = (value >> 24) & 0xFF;
    const b1 = (value >> 16) & 0xFF;
    const b2 = (value >> 8) & 0xFF;
    const b3 = value & 0xFF;
    return TranspilerTestCases.PackFourBytes(b0, b1, b2, b3);
  },

  // ========================[ IIFE PATTERNS ]========================

  /**
   * IIFE with return value
   * @returns {uint32} Result
   */
  IifeWithReturn: function() {
    const result = (function() {
      const a = 42;
      const b = 13;
      return a + b;
    })();
    return result;
  },

  /**
   * Arrow function IIFE
   * @returns {uint32} Result
   */
  ArrowIife: function() {
    const result = (() => {
      return 100;
    })();
    return result;
  },

  // ========================[ FUNCTION DEFINITION STYLES ]========================

  /**
   * Static method style (defined on object)
   * @param {uint32} x - Input
   * @returns {uint32} Result
   */
  StaticMethod: function(x) {
    return x * 2;
  },

  // ========================[ FUNCTION DEFINITION STYLES ]========================

  /**
   * ES6 arrow function
   * @param {uint32} a - Input
   * @param {uint32} b - Input
   * @returns {uint32} Result
   */
  ArrowFunction: (a, b) => {
    return a + b;
  },

  /**
   * Arrow function with implicit return
   * @param {uint32} x - Input
   * @returns {uint32} Result
   */
  ArrowFunctionImplicit: (x) => x * 3,

  /**
   * Single parameter arrow without parentheses
   * @param {uint32} n - Input
   * @returns {uint32} Result
   */
  ArrowFunctionSingleParam: n => n + 1,

  // ========================[ JAVASCRIPT TYPE CASTING IDIOMS ]========================

  /**
   * JavaScript |0 casting (convert to int32)
   * @param {float64} value - Input
   * @returns {int32} Result
   */
  BitwiseOrZero: function(value) {
    return value | 0;
  },

  /**
   * JavaScript >>>0 casting (convert to uint32)
   * @param {float64} value - Input
   * @returns {uint32} Result
   */
  UnsignedRightShiftZero: function(value) {
    return value >>> 0;
  },

  /**
   * Double tilde ~~ casting (truncate to int)
   * @param {float64} value - Input
   * @returns {int32} Result
   */
  DoubleTilde: function(value) {
    return ~~value;
  },

  /**
   * Unary plus + casting (convert to number)
   * @param {string} str - Input
   * @returns {float64} Result
   */
  UnaryPlus: function(str) {
    return +str;
  },

  /**
   * Double negation !! casting (convert to boolean)
   * @param {object} value - Input
   * @returns {boolean} Result
   */
  DoubleNegation: function(value) {
    return !!value;
  },

  /**
   * Combined casting idioms
   * @param {float64} x - Input
   * @returns {uint32} Result
   */
  CombinedCasting: function(x) {
    const asInt = x | 0;
    const asUint = x >>> 0;
    const truncated = ~~x;
    return (asInt + asUint + truncated) >>> 0;
  },

  // ========================[ ADVANCED TERNARY PATTERNS ]========================

  /**
   * Nested ternary expressions
   * @param {int32} value - Input
   * @returns {byte} Result
   */
  NestedTernary: function(value) {
    return value < 0 ? 0 : value > 255 ? 255 : value;
  },

  /**
   * Ternary with type coercion
   * @param {uint32} flags - Input
   * @returns {boolean} Result
   */
  TernaryTypeCoercion: function(flags) {
    return flags & 0x01 ? true : false;
  },

  /**
   * Ternary in function call arguments
   * @param {byte[]} data - Input
   * @param {int32} index - Index
   * @returns {uint32} Result
   */
  TernaryInFunctionCall: function(data, index) {
    const b0 = index < data.length ? data[index] : 0;
    const b1 = index + 1 < data.length ? data[index + 1] : 0;
    return (b0 << 8) | b1;
  },

  /**
   * Chained ternaries for lookup table
   * @param {byte} opcode - Input
   * @returns {int32} Result
   */
  ChainedTernary: function(opcode) {
    return opcode === 0x00 ? 0 :
           opcode === 0x01 ? 1 :
           opcode === 0x02 ? 2 :
           opcode === 0x03 ? 3 : -1;
  },

  // ========================[ OBJECT & CLASS PATTERNS ]========================

  /**
   * Constructor function pattern
   * @param {uint32} initialValue - Input
   * @returns {object} Result
   */
  ConstructorPattern: function(initialValue) {
    function Counter(initial) {
      this.value = initial;
      this.increment = function() {
        this.value++;
      };
    }
    const counter = new Counter(initialValue);
    return counter;
  },

  /**
   * Prototype method assignment
   * @returns {uint32} Result
   */
  PrototypePattern: function() {
    function Box() {
      this.value = 0;
    }
    Box.prototype.getValue = function() {
      return this.value;
    };
    Box.prototype.setValue = function(v) {
      this.value = v;
    };
    const box = new Box();
    box.setValue(42);
    return box.getValue();
  },

  /**
   * Object literal with shorthand properties
   * @param {uint32} x - Input
   * @param {uint32} y - Input
   * @returns {uint32} Result
   */
  ObjectShorthand: function(x, y) {
    const sum = x + y;
    const product = x * y;
    const obj = { sum, product };
    return obj.sum + obj.product;
  },

  /**
   * Method shorthand syntax (ES6)
   * Generates a private nested class with methods
   * @returns {uint32} Result
   */
  MethodShorthand: function() {
    const obj = {
      value: 10,
      getValue() {
        return this.value;
      },
      double() {
        return this.value * 2;
      }
    };
    return obj.getValue() + obj.double();
  },

  // ========================[ TYPE NARROWING PATTERNS ]========================

  /**
   * Int multiplication assigned to uint (requires explicit cast in C#)
   * @param {int32} byteIndex - Input
   * @returns {uint32} Result
   */
  IntToUintMultiplication: function(byteIndex) {
    const shift = byteIndex * 8; // int * int = int, but assigned to variable used as uint
    return shift >>> 0;
  },

  /**
   * Long to ulong conversion (signed to unsigned)
   * @param {uint32} high32 - Input
   * @param {uint32} low32 - Input
   * @returns {uint64} Result
   */
  LongToUlongConversion: function(high32, low32) {
    // uint * long = long, but return type is ulong
    return high32 * 4294967296 + low32;
  },

  /**
   * Int to byte narrowing
   * @param {int32} value - Input
   * @returns {byte} Result
   */
  IntToByteNarrowing: function(value) {
    return value & 0xFF;
  },

  /**
   * Array with specific element type for spread operations
   * @param {byte} value - Input
   * @returns {byte[]} Result
   */
  ArrayElementTypeSpread: function(value) {
    const arr = [value, value, value];
    return arr;
  },

  /**
   * Return type must match declared type (tuple vs simple)
   * @param {float64} value - Input
   * @returns {Object} {high32: uint32, low32: uint32}
   */
  TupleReturn: function(value) {
    const low32 = value & 0xFFFFFFFF;
    const high32 = Math.floor(value / 4294967296);
    return { high32: high32, low32: low32 };
  },

  // ========================[ TUPLE WITH ARRAY ELEMENTS ]========================

  /**
   * Tuple with array element types - tests tuple type parsing with []
   * @param {uint32[]} a - 128-bit value as 4 uint32s
   * @returns {(high64: uint32[], low64: uint32[])} Tuple of two uint32[] arrays
   */
  TupleWithArrayTypes: function(a) {
    return {
      high64: [a[0], a[1]],
      low64: [a[2], a[3]]
    };
  },

  /**
   * Array with uint element expressions requiring casts
   * @param {ushort[]} words16 - Input array of ushort
   * @returns {uint32[]} Packed result
   */
  ArrayWithBinaryExpressions: function(words16) {
    return [
      ((words16[0] & 65535) << 16) | (words16[1] & 65535),
      ((words16[2] & 65535) << 16) | (words16[3] & 65535)
    ];
  },

  // ========================[ LIST ADD WITH BYTE NARROWING ]========================

  /**
   * List.Add with bitwise AND other than 255
   * @param {string} str - ASCII string
   * @returns {byte[]} 7-bit ASCII bytes
   */
  ListAddWith127Mask: function(str) {
    const bytes = [];
    for (let i = 0; i < str.length; ++i) {
      bytes.push(str.charCodeAt(i) & 127);
    }
    return bytes;
  },

  /**
   * List.Add with complex expression
   * @param {uint32[]} words - Input words
   * @returns {byte[]} Big-endian bytes
   */
  ListAddComplexExpression: function(words) {
    const bytes = [];
    for (let i = 0; i < words.length; ++i) {
      const w = words[i];
      bytes.push((w >>> 24) & 0xFF);
      bytes.push((w >>> 16) & 0xFF);
      bytes.push((w >>> 8) & 0xFF);
      bytes.push(w & 0xFF);
    }
    return bytes;
  },

  // ========================[ FLOATING POINT TO INT CONVERSIONS ]========================

  /**
   * Floating point value with >>> 0 cast
   * @param {float64} value - Input
   * @returns {uint32} Result
   */
  FloatUnsignedShift: function(value) {
    return value >>> 0;
  },

  /**
   * Floating point value with | 0 truncation
   * @param {float64} value - Input
   * @returns {int32} Result
   */
  FloatBitwiseOr: function(value) {
    return value | 0;
  },

  /**
   * Math.floor on float with conversion
   * @param {float64} value - Input
   * @returns {uint32} Result
   */
  MathFloorToUint: function(value) {
    return Math.floor(value) >>> 0;
  },

  // ========================[ VARIABLE TYPE DECLARATIONS ]========================

  /**
   * Variable declared with uint type assigned int expression
   * @param {int32} a - Input
   * @param {int32} b - Input
   * @returns {uint32} Result
   */
  IntExpressionToUintVar: function(a, b) {
    /** @type {uint32} */
    const result = a * b;
    return result >>> 0;
  },

  /**
   * Loop variable type inference
   * @param {byte[]} data - Input
   * @returns {byte} Sum modulo 256
   */
  LoopVariableType: function(data) {
    let sum = 0;
    for (let i = 0; i < data.length; ++i) {
      sum = (sum + data[i]) & 0xFF;
    }
    return sum;
  }

};

// Additional static method added after object creation
TranspilerTestCases.AdditionalStatic = function(value) {
  return value + 100;
};

// ========================[ UMD PATTERN ]========================

(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // CommonJS
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define([], factory);
  } else {
    // Global
    root.TranspilerTestCases = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  return TranspilerTestCases;
}));
