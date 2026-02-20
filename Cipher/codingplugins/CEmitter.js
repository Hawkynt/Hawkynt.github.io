/**
 * CEmitter.js - C Code Generator from C AST
 * Generates properly formatted C source code from CAST nodes
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> C AST -> C Emitter -> C Source
 */

(function(global) {
  'use strict';

  // Load CAST if available
  let CAST;
  if (typeof require !== 'undefined') {
    CAST = require('./CAST.js');
  } else if (global.CAST) {
    CAST = global.CAST;
  }

  /**
   * C Code Emitter
   * Generates formatted C code from a C AST
   *
   * Supported Options:
   * - indent: string - Indentation string (default: '    ')
   * - newline/lineEnding: string - Line ending character (default: '\n')
   * - addComments: boolean - Emit comments. Default: true
   */
  class CEmitter {
    constructor(options = {}) {
      this.options = options;
      this.indentString = options.indent || '    ';
      this.indentLevel = 0;
      this.newline = options.newline || options.lineEnding || '\n';
    }

    /**
     * Emit C code from a C AST node
     * @param {CNode} node - The AST node to emit
     * @returns {string} Generated C code
     */
    emit(node) {
      if (!node) return '';

      if (typeof node === 'string') {
        // Handle JavaScript keywords that slip through as raw strings
        if (node === 'undefined' || node === 'null')
          return 'NULL';
        return node;
      }

      // Handle arrays
      if (Array.isArray(node)) {
        return node.map(n => this.emit(n)).filter(s => s).join('');
      }

      // Duck typing fallback for nodes with missing nodeType
      if (!node.nodeType) {
        if (node.statements !== undefined) return this.emitBlock(node);
        if (node.target && node.value && node.operator !== undefined) return this.emitAssignment(node);
        if (node.name && typeof node.name === 'string') return this.emitIdentifier(node);
        // Skip known control objects
        if (node.isMethod !== undefined || node.initStatement !== undefined) return '';
        // Show more debug info for unknown nodes
        const keys = Object.keys(node).slice(0, 5).join(', ');
        console.error(`No emitter for node type: ${node.nodeType} (keys: ${keys})`);
        return '';
      }

      const emitterMethod = `emit${node.nodeType}`;
      if (typeof this[emitterMethod] === 'function') {
        return this[emitterMethod](node);
      }

      console.error(`No emitter for node type: ${node.nodeType}`);
      return `/* Unknown node type: ${node.nodeType} */`;
    }

    // ========================[ HELPERS ]========================

    indent() {
      return this.indentString.repeat(this.indentLevel);
    }

    line(content = '') {
      return content ? `${this.indent()}${content}${this.newline}` : this.newline;
    }

    // ========================[ FILE ]========================

    emitFile(node) {
      let code = '';

      // File header comment
      if (node.headerComment && this.options.addComments !== false) {
        code += this.emit(node.headerComment);
        code += this.newline;
      }

      // Includes
      for (const include of node.includes) {
        code += this.emit(include);
      }
      if (node.includes.length > 0) {
        code += this.newline;
      }

      // Add crypto helper macros/inline functions
      if (this.options.addCryptoHelpers !== false) {
        code += this.emitCryptoHelpers();
        code += this.newline;
      }

      // Defines
      for (const define of node.defines) {
        code += this.emit(define);
      }
      if (node.defines.length > 0) {
        code += this.newline;
      }

      // Typedefs
      for (const typedef of node.typedefs) {
        code += this.emit(typedef);
      }
      if (node.typedefs.length > 0) {
        code += this.newline;
      }

      // Forward struct declarations for external types used in struct fields/function signatures
      // Must be placed BEFORE structs that reference them
      const forwardStructDecls = this.collectForwardStructDeclarations(node);
      if (forwardStructDecls.length > 0) {
        code += '/* Forward struct declarations */\n';
        for (const structName of forwardStructDecls)
          code += this.line(`typedef struct ${structName} ${structName};`);
        code += this.newline;
      }

      // Structs - topologically sorted so dependencies come first
      const sortedStructs = this.sortStructsTopologically(node.structs);
      for (const struct of sortedStructs) {
        code += this.emit(struct);
        code += this.newline;
      }

      // Enums
      for (const enumDecl of node.enums) {
        code += this.emit(enumDecl);
        code += this.newline;
      }

      // Function prototypes
      for (const proto of node.prototypes) {
        code += this.emitFunctionPrototype(proto);
      }
      if (node.prototypes.length > 0) {
        code += this.newline;
      }

      // Global variables
      for (const globalVar of node.globals) {
        code += this.emitGlobalVariable(globalVar);
      }
      if (node.globals.length > 0) {
        code += this.newline;
      }

      // Auto-generate forward declarations for all functions
      if (node.functions.length > 0 && this.options.addForwardDeclarations !== false) {
        code += '/* Forward declarations */\n';
        for (const func of node.functions) {
          code += this.emitFunctionPrototype(func);
        }
        code += this.newline;
      }

      // Functions
      for (const func of node.functions) {
        code += this.emit(func);
        code += this.newline;
      }

      return code;
    }

    /**
     * Topologically sort structs so dependencies come before dependents
     * e.g., if StructA has a field of type StructB, StructB must be defined first
     */
    sortStructsTopologically(structs) {
      if (!structs || structs.length <= 1) return structs;

      // Build name -> struct map
      const structMap = new Map();
      for (const s of structs) {
        structMap.set(s.name, s);
      }

      // Extract type name from a CType, handling pointers and arrays
      const getTypeName = (type) => {
        if (!type) return null;
        // For pointers, get the base type
        if (type.isPointer || type.isArray) {
          return type.baseType ? getTypeName(type.baseType) : type.name;
        }
        return type.name;
      };

      // Build dependency graph: struct name -> set of struct names it depends on
      const dependencies = new Map();
      for (const s of structs) {
        const deps = new Set();
        for (const field of (s.fields || [])) {
          const typeName = getTypeName(field.type);
          // Only count as dependency if it's another struct in our list
          // AND it's not a pointer (pointers don't require definition before use)
          if (typeName && structMap.has(typeName) && typeName !== s.name) {
            // Check if field type is a pointer - pointers don't need forward declaration
            if (field.type && !field.type.isPointer) {
              deps.add(typeName);
            }
          }
        }
        dependencies.set(s.name, deps);
      }

      // Kahn's algorithm for topological sort
      const result = [];
      const visited = new Set();
      const visiting = new Set();

      const visit = (name) => {
        if (visited.has(name)) return true;
        if (visiting.has(name)) return false; // Cycle detected

        visiting.add(name);

        const deps = dependencies.get(name) || new Set();
        for (const dep of deps) {
          if (!visit(dep)) return false;
        }

        visiting.delete(name);
        visited.add(name);
        const s = structMap.get(name);
        if (s) result.push(s);
        return true;
      };

      for (const s of structs) {
        if (!visit(s.name)) {
          // Cycle detected - fall back to original order
          console.warn('Cycle detected in struct dependencies, using original order');
          return structs;
        }
      }

      return result;
    }

    /**
     * Collect struct types referenced in function signatures but not defined
     * Returns array of struct names that need forward declarations
     */
    collectForwardStructDeclarations(fileNode) {
      // Built-in primitive types that don't need forward declarations
      const primitiveTypes = new Set([
        'void', 'char', 'short', 'int', 'long', 'float', 'double', 'bool',
        'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
        'int8_t', 'int16_t', 'int32_t', 'int64_t',
        'size_t', 'ssize_t', 'ptrdiff_t', 'intptr_t', 'uintptr_t',
        'unsigned', 'signed', 'auto'
      ]);

      // Collect names of all defined structs
      const definedStructs = new Set();
      for (const struct of (fileNode.structs || []))
        definedStructs.add(struct.name);

      // Also include structs from typedefs
      for (const typedef of (fileNode.typedefs || [])) {
        if (typedef.alias)
          definedStructs.add(typedef.alias);
      }

      // Add framework types that are always defined in emitCryptoHelpers
      const frameworkTypes = ['LinkItem', 'Vulnerability', 'TestCase', 'KeySize'];
      for (const t of frameworkTypes)
        definedStructs.add(t);

      // Helper to extract base type name from a type (handling pointers/arrays)
      const getBaseTypeName = (type) => {
        if (!type) return null;
        if (type.isPointer || type.isArray)
          return type.baseType ? getBaseTypeName(type.baseType) : type.name;
        return type.name;
      };

      // Collect all referenced struct types from function signatures and struct fields
      const referencedTypes = new Set();

      for (const func of (fileNode.functions || [])) {
        // Check return type
        const returnTypeName = getBaseTypeName(func.returnType);
        if (returnTypeName)
          referencedTypes.add(returnTypeName);

        // Check parameter types (CFunction uses 'parameters', not 'params')
        for (const param of (func.parameters || func.params || [])) {
          const paramTypeName = getBaseTypeName(param.type);
          if (paramTypeName)
            referencedTypes.add(paramTypeName);
        }
      }

      // Also check struct field types for undefined types
      for (const struct of (fileNode.structs || [])) {
        for (const field of (struct.fields || [])) {
          const fieldTypeName = getBaseTypeName(field.type);
          if (fieldTypeName)
            referencedTypes.add(fieldTypeName);
        }
      }

      // Filter to types that need forward declarations:
      // - Not a primitive type
      // - Not already defined in structs
      // - Looks like a struct name (PascalCase, no special chars)
      const needsForwardDecl = [];
      for (const typeName of referencedTypes) {
        if (!typeName) continue;
        if (primitiveTypes.has(typeName)) continue;
        if (definedStructs.has(typeName)) continue;
        // Only forward-declare PascalCase names that look like struct types
        if (/^[A-Z][a-zA-Z0-9]*$/.test(typeName))
          needsForwardDecl.push(typeName);
      }

      return needsForwardDecl.sort();
    }

    emitInclude(node) {
      if (node.isSystem) {
        return this.line(`#include <${node.path}>`);
      } else {
        return this.line(`#include "${node.path}"`);
      }
    }

    /**
     * Emit crypto helper macros and inline functions for common operations
     */
    emitCryptoHelpers() {
      return `/* Crypto helper macros and inline functions */
#define to_byte(x) ((uint8_t)((x) & 0xFF))
#define to_uint16(x) ((uint16_t)((x) & 0xFFFF))
#define to_uint32(x) ((uint32_t)(x))
#define to_uint64(x) ((uint64_t)(x))
#define xor_n(a, b) ((a) ^ (b))
#define or_n(a, b) ((a) | (b))
#define and_n(a, b) ((a) & (b))
#define not_n(a) (~(a))
#define shl32(x, n) (((uint32_t)(x)) << (n))
#define shr32(x, n) (((uint32_t)(x)) >> (n))
#define shl64(x, n) (((uint64_t)(x)) << ((n) & 63))
#define shr64(x, n) (((uint64_t)(x)) >> ((n) & 63))
#define rotl32(x, n) ((((uint32_t)(x)) << ((n) & 31)) | (((uint32_t)(x)) >> (32 - ((n) & 31))))
#define rotr32(x, n) ((((uint32_t)(x)) >> ((n) & 31)) | (((uint32_t)(x)) << (32 - ((n) & 31))))
#define rotl64(x, n) ((((uint64_t)(x)) << ((n) & 63)) | (((uint64_t)(x)) >> (64 - ((n) & 63))))
#define rotr64(x, n) ((((uint64_t)(x)) >> ((n) & 63)) | (((uint64_t)(x)) << (64 - ((n) & 63))))
#define rotl8(x, n) ((uint8_t)(((uint8_t)(x) << ((n) & 7)) | ((uint8_t)(x) >> (8 - ((n) & 7)))))
#define rotr8(x, n) ((uint8_t)(((uint8_t)(x) >> ((n) & 7)) | ((uint8_t)(x) << (8 - ((n) & 7)))))
#define rotl16(x, n) ((uint16_t)(((uint16_t)(x) << ((n) & 15)) | ((uint16_t)(x) >> (16 - ((n) & 15)))))
#define rotr16(x, n) ((uint16_t)(((uint16_t)(x) >> ((n) & 15)) | ((uint16_t)(x) << (16 - ((n) & 15)))))
#define get_bit(x, n) (((x) >> (n)) & 1)
#define set_bit(x, n) ((x) | (1 << (n)))
#define set_bit_value(x, n, v) ((v) ? ((x) | (1 << (n))) : ((x) & ~(1 << (n))))
#define clear_bit(x, n) ((x) & ~(1 << (n)))
#define get_byte(x, n) ((uint8_t)(((x) >> ((n) * 8)) & 0xFF))

/* Portable population count (number of set bits) */
static inline unsigned int popcount32(uint32_t x) {
    x = x - ((x >> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
    x = (x + (x >> 4)) & 0x0F0F0F0F;
    return (x * 0x01010101) >> 24;
}

static inline unsigned int popcount64(uint64_t x) {
    x = x - ((x >> 1) & 0x5555555555555555ULL);
    x = (x & 0x3333333333333333ULL) + ((x >> 2) & 0x3333333333333333ULL);
    x = (x + (x >> 4)) & 0x0F0F0F0F0F0F0F0FULL;
    return (x * 0x0101010101010101ULL) >> 56;
}

/* Random number generation (simple PRNG for non-cryptographic use in transpiled code) */
static uint32_t _rng_state = 0x12345678;
static inline uint32_t secure_random_int(uint32_t max) {
    /* Simple LCG - NOT cryptographically secure, for testing only */
    _rng_state = _rng_state * 1103515245 + 12345;
    return max > 0 ? (_rng_state >> 16) % max : 0;
}
static inline uint32_t secure_random(uint32_t max) {
    return secure_random_int(max);
}
static inline void secure_random_bytes(uint8_t* buf, size_t len) {
    for (size_t i = 0; i < len; i++) {
        buf[i] = (uint8_t)secure_random_int(256);
    }
}

/* Constant-time secure comparison - resists timing attacks */
/* Array version: secure_compare(ptr1, ptr2, len) */
static inline int secure_compare_array(const uint8_t* a, const uint8_t* b, size_t len) {
    uint8_t diff = 0;
    for (size_t i = 0; i < len; i++) {
        diff |= a[i] ^ b[i];
    }
    return diff == 0;
}

/* Scalar version for comparing uint8_t* pointers directly (by value as uint32_t) */
/* This handles: secure_compare(tag1, tag2) where tags are scalar uint32_t */
static inline int secure_compare(const uint8_t* a, const uint8_t* b) {
    /* Compare pointer contents assuming 16-byte tags (128 bits) */
    if (!a || !b) return a == b;
    uint8_t diff = 0;
    for (size_t i = 0; i < 16; i++) {
        diff |= a[i] ^ b[i];
    }
    return diff == 0;
}

static inline uint16_t pack16_be(uint8_t b0, uint8_t b1) {
    return ((uint16_t)b0 << 8) | (uint16_t)b1;
}

static inline uint16_t pack16_le(uint8_t b0, uint8_t b1) {
    return (uint16_t)b0 | ((uint16_t)b1 << 8);
}

static inline void unpack16_be(uint16_t w, uint8_t* out) {
    out[0] = (uint8_t)(w >> 8); out[1] = (uint8_t)w;
}

static inline void unpack16_le(uint16_t w, uint8_t* out) {
    out[0] = (uint8_t)w; out[1] = (uint8_t)(w >> 8);
}

/* Unpack returning variants - allocate and return new buffer (caller must free) */
static inline uint8_t* unpack16_be_ret(uint16_t w) {
    uint8_t* _buf = (uint8_t*)malloc(2);
    _buf[0] = (uint8_t)(w >> 8); _buf[1] = (uint8_t)w;
    return _buf;
}

static inline uint8_t* unpack16_le_ret(uint16_t w) {
    uint8_t* _buf = (uint8_t*)malloc(2);
    _buf[0] = (uint8_t)w; _buf[1] = (uint8_t)(w >> 8);
    return _buf;
}

static inline uint32_t pack32_be(uint8_t b0, uint8_t b1, uint8_t b2, uint8_t b3) {
    return ((uint32_t)b0 << 24) | ((uint32_t)b1 << 16) | ((uint32_t)b2 << 8) | (uint32_t)b3;
}

static inline uint32_t pack32_le(uint8_t b0, uint8_t b1, uint8_t b2, uint8_t b3) {
    return (uint32_t)b0 | ((uint32_t)b1 << 8) | ((uint32_t)b2 << 16) | ((uint32_t)b3 << 24);
}

static inline void unpack32_be(uint32_t w, uint8_t* out) {
    out[0] = (uint8_t)(w >> 24); out[1] = (uint8_t)(w >> 16);
    out[2] = (uint8_t)(w >> 8); out[3] = (uint8_t)w;
}

static inline void unpack32_le(uint32_t w, uint8_t* out) {
    out[0] = (uint8_t)w; out[1] = (uint8_t)(w >> 8);
    out[2] = (uint8_t)(w >> 16); out[3] = (uint8_t)(w >> 24);
}

static inline uint8_t* unpack32_be_ret(uint32_t w) {
    uint8_t* _buf = (uint8_t*)malloc(4);
    _buf[0] = (uint8_t)(w >> 24); _buf[1] = (uint8_t)(w >> 16);
    _buf[2] = (uint8_t)(w >> 8); _buf[3] = (uint8_t)w;
    return _buf;
}

static inline uint8_t* unpack32_le_ret(uint32_t w) {
    uint8_t* _buf = (uint8_t*)malloc(4);
    _buf[0] = (uint8_t)w; _buf[1] = (uint8_t)(w >> 8);
    _buf[2] = (uint8_t)(w >> 16); _buf[3] = (uint8_t)(w >> 24);
    return _buf;
}

static inline uint64_t pack64_be(const uint8_t* b) {
    return ((uint64_t)b[0] << 56) | ((uint64_t)b[1] << 48) | ((uint64_t)b[2] << 40) | ((uint64_t)b[3] << 32) |
           ((uint64_t)b[4] << 24) | ((uint64_t)b[5] << 16) | ((uint64_t)b[6] << 8) | (uint64_t)b[7];
}

static inline uint64_t pack64_le(const uint8_t* b) {
    return (uint64_t)b[0] | ((uint64_t)b[1] << 8) | ((uint64_t)b[2] << 16) | ((uint64_t)b[3] << 24) |
           ((uint64_t)b[4] << 32) | ((uint64_t)b[5] << 40) | ((uint64_t)b[6] << 48) | ((uint64_t)b[7] << 56);
}

static inline void unpack64_be(uint64_t w, uint8_t* out) {
    out[0] = (uint8_t)(w >> 56); out[1] = (uint8_t)(w >> 48);
    out[2] = (uint8_t)(w >> 40); out[3] = (uint8_t)(w >> 32);
    out[4] = (uint8_t)(w >> 24); out[5] = (uint8_t)(w >> 16);
    out[6] = (uint8_t)(w >> 8); out[7] = (uint8_t)w;
}

static inline void unpack64_le(uint64_t w, uint8_t* out) {
    out[0] = (uint8_t)w; out[1] = (uint8_t)(w >> 8);
    out[2] = (uint8_t)(w >> 16); out[3] = (uint8_t)(w >> 24);
    out[4] = (uint8_t)(w >> 32); out[5] = (uint8_t)(w >> 40);
    out[6] = (uint8_t)(w >> 48); out[7] = (uint8_t)(w >> 56);
}

static inline uint8_t* unpack64_be_ret(uint64_t w) {
    uint8_t* _buf = (uint8_t*)malloc(8);
    _buf[0] = (uint8_t)(w >> 56); _buf[1] = (uint8_t)(w >> 48);
    _buf[2] = (uint8_t)(w >> 40); _buf[3] = (uint8_t)(w >> 32);
    _buf[4] = (uint8_t)(w >> 24); _buf[5] = (uint8_t)(w >> 16);
    _buf[6] = (uint8_t)(w >> 8); _buf[7] = (uint8_t)w;
    return _buf;
}

static inline uint8_t* unpack64_le_ret(uint64_t w) {
    uint8_t* _buf = (uint8_t*)malloc(8);
    _buf[0] = (uint8_t)w; _buf[1] = (uint8_t)(w >> 8);
    _buf[2] = (uint8_t)(w >> 16); _buf[3] = (uint8_t)(w >> 24);
    _buf[4] = (uint8_t)(w >> 32); _buf[5] = (uint8_t)(w >> 40);
    _buf[6] = (uint8_t)(w >> 48); _buf[7] = (uint8_t)(w >> 56);
    return _buf;
}

static inline void xor_arrays(uint8_t* dst, const uint8_t* src, size_t len) {
    for (size_t i = 0; i < len; ++i) dst[i] ^= src[i];
}

/* XOR two arrays and return a new array with the result */
static inline uint8_t* array_xor(const uint8_t* a, const uint8_t* b, size_t len) {
    uint8_t* result = (uint8_t*)malloc(len);
    if (result) {
        for (size_t i = 0; i < len; ++i) result[i] = a[i] ^ b[i];
    }
    return result;
}

static inline void copy_array(uint8_t* dst, const uint8_t* src, size_t len) {
    memcpy(dst, src, len);
}

/* Returning variant - allocates new array and copies content */
static inline uint8_t* copy_array_ret(const uint8_t* src, size_t len) {
    uint8_t* result = (uint8_t*)malloc(len);
    if (result) memcpy(result, src, len);
    return result;
}

/* Returning variant for uint32_t arrays */
static inline uint32_t* copy_array32_ret(const uint32_t* src, size_t count) {
    size_t bytes = count * sizeof(uint32_t);
    uint32_t* result = (uint32_t*)malloc(bytes);
    if (result) memcpy(result, src, bytes);
    return result;
}

static inline bool arrays_equal(const uint8_t* a, size_t a_len, const uint8_t* b, size_t b_len) {
    if (a_len != b_len) return false;
    return memcmp(a, b, a_len) == 0;
}

static inline bool array_includes(const uint8_t* arr, size_t len, uint8_t val) {
    for (size_t i = 0; i < len; ++i) {
        if (arr[i] == val) return true;
    }
    return false;
}

static inline ptrdiff_t array_index_of(const uint8_t* arr, size_t len, uint8_t val) {
    for (size_t i = 0; i < len; ++i) {
        if (arr[i] == val) return (ptrdiff_t)i;
    }
    return -1;
}

static inline void concat_arrays(uint8_t* dst, const uint8_t* a, size_t a_len, const uint8_t* b, size_t b_len) {
    memcpy(dst, a, a_len);
    memcpy(dst + a_len, b, b_len);
}

/* Returning variant - concatenates two arrays and returns new allocation */
static inline uint8_t* concat_arrays_ret(const uint8_t* a, size_t a_len, const uint8_t* b, size_t b_len) {
    uint8_t* result = (uint8_t*)malloc(a_len + b_len);
    if (result) {
        memcpy(result, a, a_len);
        memcpy(result + a_len, b, b_len);
    }
    return result;
}

/* Returning variant - concatenates three arrays and returns new allocation */
static inline uint8_t* concat_arrays3_ret(const uint8_t* a, size_t a_len, const uint8_t* b, size_t b_len, const uint8_t* c, size_t c_len) {
    uint8_t* result = (uint8_t*)malloc(a_len + b_len + c_len);
    if (result) {
        memcpy(result, a, a_len);
        memcpy(result + a_len, b, b_len);
        memcpy(result + a_len + b_len, c, c_len);
    }
    return result;
}

/* Returning variant - concatenates four arrays and returns new allocation */
static inline uint8_t* concat_arrays4_ret(const uint8_t* a, size_t a_len, const uint8_t* b, size_t b_len, const uint8_t* c, size_t c_len, const uint8_t* d, size_t d_len) {
    uint8_t* result = (uint8_t*)malloc(a_len + b_len + c_len + d_len);
    if (result) {
        memcpy(result, a, a_len);
        memcpy(result + a_len, b, b_len);
        memcpy(result + a_len + b_len, c, c_len);
        memcpy(result + a_len + b_len + c_len, d, d_len);
    }
    return result;
}

/* Simple returning variant for spread expressions - concatenates two 4-byte arrays */
static inline uint8_t* concat_arrays_ret_simple(const uint8_t* a, const uint8_t* b) {
    static uint8_t _buf[8];
    memcpy(_buf, a, 4);
    memcpy(_buf + 4, b, 4);
    return _buf;
}

/* Dynamic array helpers (simplified) */
#define ARRAY_PUSH(arr, arr_len, val) do { (arr)[(arr_len)++] = (val); } while(0)
#define push(arr, val) ARRAY_PUSH(arr, arr##_length, val)
#define slice(arr, start, end) ((arr) + (start))

/* Array slice - returns pointer to slice start and updates slice length */
static inline uint8_t* array_slice(const uint8_t* arr, size_t start, size_t end) {
    return (uint8_t*)(arr + start);
}

/* Array slice from index to end - for single-arg slice(start) calls */
static inline uint8_t* array_slice_from(const uint8_t* arr, size_t start) {
    return (uint8_t*)(arr + start);
}

/* Array splice - remove elements from array and shift remaining elements */
/* Note: This modifies the length variable and returns a pointer to removed elements */
static inline uint8_t* array_splice(uint8_t* arr, size_t* length, size_t start, size_t delete_count) {
    if (start >= *length) return NULL;
    if (start + delete_count > *length) delete_count = *length - start;

    /* Allocate buffer for removed elements */
    uint8_t* removed = (uint8_t*)malloc(delete_count);
    memcpy(removed, arr + start, delete_count);

    /* Shift remaining elements left */
    memmove(arr + start, arr + start + delete_count, *length - start - delete_count);
    *length -= delete_count;

    return removed;
}

/* String indexOf - find character in string, returns position or -1 */
static inline ptrdiff_t string_index_of(const char* str, char ch) {
    const char* p = strchr(str, ch);
    return p ? (p - str) : -1;
}

/* String charAt - get character at position */
static inline char string_char_at(const char* str, size_t idx) {
    return str[idx];
}

/* String split - split string by delimiter, returns array of strings (caller must free) */
/* result_length is a static variable that holds the number of parts after split */
static size_t _string_split_result_length = 0;
#define string_split_length (_string_split_result_length)
static inline char** string_split(const char* str, char delimiter) {
    if (!str) { _string_split_result_length = 0; return NULL; }
    size_t count = 1;
    for (const char* p = str; *p; ++p) if (*p == delimiter) ++count;
    char** result = (char**)malloc(count * sizeof(char*));
    if (!result) { _string_split_result_length = 0; return NULL; }
    _string_split_result_length = count;
    const char* start = str;
    size_t idx = 0;
    for (const char* p = str; ; ++p) {
        if (*p == delimiter || *p == '\\0') {
            size_t len = p - start;
            result[idx] = (char*)malloc(len + 1);
            if (result[idx]) { memcpy(result[idx], start, len); result[idx][len] = '\\0'; }
            ++idx;
            if (!*p) break;
            start = p + 1;
        }
    }
    return result;
}

/* String trim - remove leading and trailing whitespace */
static inline char* string_trim(const char* str) {
    if (!str) return NULL;
    while (*str && (*str == ' ' || *str == '\\t' || *str == '\\n' || *str == '\\r')) ++str;
    if (!*str) { char* r = (char*)malloc(1); if (r) r[0] = '\\0'; return r; }
    const char* end = str + strlen(str) - 1;
    while (end > str && (*end == ' ' || *end == '\\t' || *end == '\\n' || *end == '\\r')) --end;
    size_t len = end - str + 1;
    char* result = (char*)malloc(len + 1);
    if (result) { memcpy(result, str, len); result[len] = '\\0'; }
    return result;
}

/* String to uppercase - returns new string (caller must free) */
static inline char* to_upper_case(const char* str) {
    if (!str) return NULL;
    size_t len = strlen(str);
    char* result = (char*)malloc(len + 1);
    if (!result) return NULL;
    for (size_t i = 0; i <= len; ++i) {
        char c = str[i];
        result[i] = (c >= 'a' && c <= 'z') ? (c - 'a' + 'A') : c;
    }
    return result;
}

/* String to lowercase - returns new string (caller must free) */
static inline char* to_lower_case(const char* str) {
    if (!str) return NULL;
    size_t len = strlen(str);
    char* result = (char*)malloc(len + 1);
    if (!result) return NULL;
    for (size_t i = 0; i <= len; ++i) {
        char c = str[i];
        result[i] = (c >= 'A' && c <= 'Z') ? (c - 'A' + 'a') : c;
    }
    return result;
}

/* Filter alpha - keep only A-Z, returns new string (caller must free) */
static size_t _filter_alpha_result_length = 0;
#define filter_alpha_length (_filter_alpha_result_length)
static inline char* filter_alpha(const char* str) {
    if (!str) { _filter_alpha_result_length = 0; return NULL; }
    size_t len = strlen(str);
    char* result = (char*)malloc(len + 1);
    if (!result) { _filter_alpha_result_length = 0; return NULL; }
    size_t j = 0;
    for (size_t i = 0; i < len; ++i) {
        char c = str[i];
        // Keep A-Z and a-z
        if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z'))
            result[j++] = c;
    }
    result[j] = '\\0';
    _filter_alpha_result_length = j;
    return result;
}

/* Filter digits - keep only 0-9, returns new string (caller must free) */
static inline char* filter_digits(const char* str) {
    if (!str) return NULL;
    size_t len = strlen(str);
    char* result = (char*)malloc(len + 1);
    if (!result) return NULL;
    size_t j = 0;
    for (size_t i = 0; i < len; ++i) {
        char c = str[i];
        if (c >= '0' && c <= '9')
            result[j++] = c;
    }
    result[j] = '\\0';
    return result;
}

/* Remove whitespace - remove all spaces/tabs/newlines, returns new string (caller must free) */
static inline char* remove_whitespace(const char* str) {
    if (!str) return NULL;
    size_t len = strlen(str);
    char* result = (char*)malloc(len + 1);
    if (!result) return NULL;
    size_t j = 0;
    for (size_t i = 0; i < len; ++i) {
        char c = str[i];
        if (c != ' ' && c != '\\t' && c != '\\n' && c != '\\r')
            result[j++] = c;
    }
    result[j] = '\\0';
    return result;
}

/* String replace - replace all occurrences of old_str with new_str, returns new string (caller must free) */
static inline char* string_replace(const char* str, const char* old_str, const char* new_str) {
    if (!str || !old_str) return str ? strdup(str) : NULL;
    if (!new_str) new_str = "";
    size_t old_len = strlen(old_str);
    if (old_len == 0) return strdup(str);
    size_t new_len = strlen(new_str);
    size_t str_len = strlen(str);

    // Count occurrences
    size_t count = 0;
    const char* p = str;
    while ((p = strstr(p, old_str)) != NULL) { ++count; p += old_len; }

    // Allocate result
    size_t result_len = str_len + count * (new_len - old_len);
    char* result = (char*)malloc(result_len + 1);
    if (!result) return NULL;

    // Build result
    char* dest = result;
    p = str;
    const char* found;
    while ((found = strstr(p, old_str)) != NULL) {
        size_t prefix_len = found - p;
        memcpy(dest, p, prefix_len);
        dest += prefix_len;
        memcpy(dest, new_str, new_len);
        dest += new_len;
        p = found + old_len;
    }
    strcpy(dest, p);
    return result;
}

/* String concatenation - returns new string (caller must free) */
static inline char* string_concat(const char* str1, const char* str2) {
    if (!str1 && !str2) return NULL;
    if (!str1) return str2 ? strdup(str2) : NULL;
    if (!str2) return strdup(str1);
    size_t len1 = strlen(str1);
    size_t len2 = strlen(str2);
    char* result = (char*)malloc(len1 + len2 + 1);
    if (!result) return NULL;
    memcpy(result, str1, len1);
    memcpy(result + len1, str2, len2 + 1);
    return result;
}

/* Append a character to a string - returns new string (caller must free) */
static inline char* string_append_char(const char* str, char c) {
    if (!str) {
        char* result = (char*)malloc(2);
        if (result) { result[0] = c; result[1] = '\\0'; }
        return result;
    }
    size_t len = strlen(str);
    char* result = (char*)malloc(len + 2);
    if (!result) return NULL;
    memcpy(result, str, len);
    result[len] = c;
    result[len + 1] = '\\0';
    return result;
}

/* Array iteration helpers - expand some/every/find inline */
#define array_some_inline(arr, len, condition) ({ \\
    bool _result = false; \\
    for (size_t _i = 0; _i < (len) && !_result; ++_i) { \\
        if (condition) _result = true; \\
    } \\
    _result; \\
})

#define array_every_inline(arr, len, condition) ({ \\
    bool _result = true; \\
    for (size_t _i = 0; _i < (len) && _result; ++_i) { \\
        if (!(condition)) _result = false; \\
    } \\
    _result; \\
})

#define array_find_index_inline(arr, len, condition) ({ \\
    ptrdiff_t _result = -1; \\
    for (size_t _i = 0; _i < (len); ++_i) { \\
        if (condition) { _result = (ptrdiff_t)_i; break; } \\
    } \\
    _result; \\
})

#define array_includes(arr, len, val) ({ \\
    bool _result = false; \\
    for (size_t _i = 0; _i < (len); ++_i) { \\
        if ((arr)[_i] == (val)) { _result = true; break; } \\
    } \\
    _result; \\
})

#define array_indexOf(arr, len, val) ({ \\
    ptrdiff_t _result = -1; \\
    for (size_t _i = 0; _i < (len); ++_i) { \\
        if ((arr)[_i] == (val)) { _result = (ptrdiff_t)_i; break; } \\
    } \\
    _result; \\
})

/* Framework type stubs for algorithm metadata (not used in core crypto operations) */
typedef struct { char* url; char* title; } LinkItem;
typedef struct { char* description; char* severity; } Vulnerability;
typedef struct { char* text; char* uri; uint8_t* input; size_t input_length; uint8_t* expected; size_t expected_length; } TestCase;
typedef struct { int minSize; int maxSize; int step; } KeySize;

/* String helper for ANSI to bytes conversion */
static inline uint8_t* ansi_to_bytes(const char* str) {
    if (!str) return NULL;
    size_t len = strlen(str);
    uint8_t* result = (uint8_t*)malloc(len);
    if (result) memcpy(result, str, len);
    return result;
}

/* String helper for bytes to ANSI conversion */
static inline char* bytes_to_ansi(const uint8_t* bytes, size_t len) {
    if (!bytes) return NULL;
    char* result = (char*)malloc(len + 1);
    if (result) {
        memcpy(result, bytes, len);
        result[len] = '\\0';
    }
    return result;
}

/* Hex string to bytes conversion */
static inline uint8_t* hex_to_bytes(const char* hex) {
    if (!hex) return NULL;
    size_t len = strlen(hex);
    size_t bytes_len = len / 2;
    uint8_t* result = (uint8_t*)malloc(bytes_len);
    if (result) {
        for (size_t i = 0; i < bytes_len; ++i) {
            unsigned int byte;
            sscanf(hex + i * 2, "%2x", &byte);
            result[i] = (uint8_t)byte;
        }
    }
    return result;
}

/* Bytes to hex string conversion */
static inline char* bytes_to_hex(const uint8_t* bytes, size_t len) {
    if (!bytes) return NULL;
    char* result = (char*)malloc(len * 2 + 1);
    if (result) {
        for (size_t i = 0; i < len; ++i) {
            sprintf(result + i * 2, "%02x", bytes[i]);
        }
        result[len * 2] = '\\0';
    }
    return result;
}
`;
    }

    emitDefine(node) {
      if (node.value === null) {
        return this.line(`#define ${node.name}`);
      }

      let value = node.value;
      if (typeof value === 'object' && value.nodeType) {
        value = this.emit(value);
      }

      return this.line(`#define ${node.name} ${value}`);
    }

    emitTypedef(node) {
      let code = 'typedef ';

      if (node.targetType.nodeType === 'Struct') {
        code += this.emit(node.targetType);
        code += ` ${node.name};`;
      } else {
        code += `${this.emit(node.targetType)} ${node.name};`;
      }

      return this.line(code);
    }

    // ========================[ TYPE DECLARATIONS ]========================

    emitStruct(node) {
      let code = '';

      // Doc comment
      if (node.docComment && this.options.addComments !== false) {
        code += this.emit(node.docComment);
      }

      // Declaration line
      if (node.isTypedef) {
        code += this.line(`typedef struct ${node.tag || ''} {`);
      } else {
        code += this.line(`struct ${node.name} {`);
      }

      this.indentLevel++;

      for (const field of node.fields) {
        code += this.emit(field);
      }

      this.indentLevel--;

      if (node.isTypedef) {
        code += this.line(`} ${node.name};`);
      } else {
        code += this.line('};');
      }

      return code;
    }

    emitField(node) {
      // Guard: Ensure type is a proper CType with toString method
      // If not, fall back to uint8_t*
      let emitType = node.type;
      if (!emitType || typeof emitType.toString !== 'function' || emitType.toString() === '[object Object]') {
        emitType = { name: 'uint8_t', isPointer: true, pointerLevel: 1, toString: () => 'uint8_t*' };
      }
      // For unsized arrays in struct fields, convert to pointer type
      // Flexible array members (type[]) are only valid as the last member of a struct
      if (emitType && emitType.isArray && (emitType.arraySize === null || emitType.arraySize === undefined)) {
        // Create a proper CType pointer instead of plain object
        const baseType = emitType.baseType || { name: 'uint8_t', toString: () => 'uint8_t' };
        emitType = {
          name: baseType.name || 'uint8_t',
          isPointer: true,
          pointerLevel: 1,
          toString: () => (baseType.name || 'uint8_t') + '*'
        };
      }
      let code = this.emit(emitType) + ' ' + node.name;

      // Add array brackets after field name (C syntax: uint8_t arr[50], not uint8_t[50] arr)
      if (node.type && node.type.isArray) {
        if (node.type.arraySize !== null && node.type.arraySize !== undefined)
          code += `[${node.type.arraySize}]`;
      }

      if (node.bitWidth !== null) {
        code += ' : ' + node.bitWidth;
      }

      return this.line(code + ';');
    }

    emitEnum(node) {
      let code = '';

      if (node.docComment && this.options.addComments !== false) {
        code += this.emit(node.docComment);
      }

      if (node.isTypedef) {
        code += this.line(`typedef enum {`);
      } else {
        code += this.line(`enum ${node.name} {`);
      }

      this.indentLevel++;

      for (let i = 0; i < node.values.length; i++) {
        const value = node.values[i];
        code += this.emit(value);
        if (i < node.values.length - 1) {
          code = code.trimEnd() + ',' + this.newline;
        }
      }

      this.indentLevel--;

      if (node.isTypedef) {
        code += this.line(`} ${node.name};`);
      } else {
        code += this.line('};');
      }

      return code;
    }

    emitEnumValue(node) {
      let code = this.indent() + node.name;
      if (node.value !== null) {
        code += ' = ' + this.emit(node.value);
      }
      return code;
    }

    // ========================[ FUNCTIONS ]========================

    emitFunction(node) {
      let code = '';

      // Track current function's return type for compound literal returns
      const prevReturnType = this.currentReturnType;
      this.currentReturnType = node.returnType;

      // Doc comment
      if (node.docComment && this.options.addComments !== false) {
        code += this.emit(node.docComment);
      }

      // Declaration line
      let decl = '';
      if (node.isStatic) decl += 'static ';
      if (node.isInline) decl += 'inline ';
      if (node.isExtern) decl += 'extern ';

      decl += this.emit(node.returnType) + ' ';
      decl += node.name;

      // Parameters
      decl += '(';

      if (node.parameters.length === 0) {
        decl += 'void';
      } else {
        const params = node.parameters.map(p => this.emitParameterDecl(p));
        decl += params.join(', ');
      }

      decl += ')';

      code += this.line(decl + ' {');

      if (node.body) {
        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
      }

      code += this.line('}');

      // Restore previous return type context
      this.currentReturnType = prevReturnType;

      return code;
    }

    emitFunctionPrototype(node) {
      let decl = '';
      if (node.isStatic) decl += 'static ';
      if (node.isInline) decl += 'inline ';
      if (node.isExtern) decl += 'extern ';

      decl += this.emit(node.returnType) + ' ';
      decl += node.name;

      // Parameters
      decl += '(';

      if (node.parameters.length === 0) {
        decl += 'void';
      } else {
        const params = node.parameters.map(p => this.emitParameterDecl(p));
        decl += params.join(', ');
      }

      decl += ');';

      return this.line(decl);
    }

    emitParameterDecl(node) {
      return this.emit(node.type) + ' ' + node.name;
    }

    emitGlobalVariable(node) {
      // Handle static and const modifiers on the variable
      let prefix = '';
      if (node.isStatic) prefix += 'static ';
      if (node.isConst) prefix += 'const ';

      let code = prefix + this.emit(node.type) + ' ' + node.name;

      // Handle array declarations: type name[size] in C
      if (node.type && node.type.isArray) {
        // For nested arrays (2D), emit both dimensions: name[outer][inner]
        if (node.type.baseType && node.type.baseType.isArray) {
          const outerSize = node.type.arraySize;
          const innerSize = node.type.baseType.arraySize;
          // Outer dimension can be empty (size inferred from initializer)
          if (outerSize !== undefined && outerSize !== null)
            code += `[${outerSize}]`;
          // Inner dimension must be specified
          if (innerSize !== undefined && innerSize !== null)
            code += `[${innerSize}]`;
        } else {
          const arraySize = node.type.arraySize;
          if (arraySize !== undefined && arraySize !== null)
            code += `[${arraySize}]`;
        }
      }

      if (node.initializer) {
        code += ' = ' + this.emit(node.initializer);
      }

      return this.line(code + ';');
    }

    // ========================[ STATEMENTS ]========================

    emitBlock(node) {
      let code = this.line('{');
      this.indentLevel++;
      code += this.emitBlockContents(node);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitBlockContents(node) {
      let code = '';

      if (!node || !node.statements) {
        return code;
      }

      for (const stmt of node.statements) {
        code += this.emit(stmt);
      }

      return code;
    }

    emitVariable(node) {
      let code = this.emit(node.type) + ' ' + node.name;

      // Handle array declarations: type name[size] in C
      if (node.type && node.type.isArray) {
        const arraySize = node.type.arraySize;
        if (arraySize !== undefined && arraySize !== null) {
          code += `[${arraySize}]`;
        } else {
          code += '[]';
        }
      }

      if (node.initializer) {
        code += ' = ' + this.emit(node.initializer);
      }

      return this.line(code + ';');
    }

    emitExpressionStatement(node) {
      return this.line(this.emit(node.expression) + ';');
    }

    emitReturn(node) {
      if (node.expression) {
        // Handle struct initializer returns - need compound literal with type
        if (node.expression.nodeType === 'StructInitializer' && this.currentReturnType) {
          const returnType = this.emit(this.currentReturnType);
          const structInit = this.emitStructInitializer(node.expression);
          return this.line(`return (${returnType})${structInit};`);
        }
        return this.line('return ' + this.emit(node.expression) + ';');
      }
      return this.line('return;');
    }

    emitIf(node) {
      let code = this.line('if (' + this.emit(node.condition) + ') {');
      this.indentLevel++;
      code += this.emitBlockContents(node.thenBranch);
      this.indentLevel--;
      code += this.line('}');

      if (node.elseBranch) {
        if (node.elseBranch.nodeType === 'If') {
          // else if
          code = code.trimEnd() + ' else ';
          const elseIfCode = this.emitIf(node.elseBranch);
          code += elseIfCode.replace(/^\s*/, '');
        } else {
          code = code.trimEnd() + ' else {' + this.newline;
          this.indentLevel++;
          code += this.emitBlockContents(node.elseBranch);
          this.indentLevel--;
          code += this.line('}');
        }
      }

      return code;
    }

    emitFor(node) {
      let code = this.indent() + 'for (';

      // Init
      if (node.init) {
        const initCode = this.emit(node.init);
        // Remove trailing semicolon and newline from init
        code += initCode.trim().replace(/;$/, '');
      }
      code += '; ';

      // Condition
      if (node.condition) {
        code += this.emit(node.condition);
      }
      code += '; ';

      // Update
      if (node.update) {
        code += this.emit(node.update);
      }

      code += ') {' + this.newline;

      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;

      code += this.line('}');
      return code;
    }

    emitWhile(node) {
      let code = this.line('while (' + this.emit(node.condition) + ') {');
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitDoWhile(node) {
      let code = this.line('do {');
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line('} while (' + this.emit(node.condition) + ');');
      return code;
    }

    emitSwitch(node) {
      let code = this.line('switch (' + this.emit(node.expression) + ') {');
      this.indentLevel++;

      for (const caseNode of node.cases) {
        code += this.emit(caseNode);
      }

      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitCase(node) {
      let code = '';

      if (node.isDefault) {
        code += this.line('default:');
      } else {
        code += this.line('case ' + this.emit(node.value) + ':');
      }

      this.indentLevel++;
      for (const stmt of node.statements) {
        code += this.emit(stmt);
      }
      this.indentLevel--;

      return code;
    }

    emitBreak(node) {
      return this.line('break;');
    }

    emitContinue(node) {
      return this.line('continue;');
    }

    // ========================[ EXPRESSIONS ]========================

    emitLiteral(node) {
      if (node.literalType === 'bool') {
        return node.value ? 'true' : 'false';
      }

      if (node.literalType === 'string') {
        const escaped = String(node.value)
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        return `"${escaped}"`;
      }

      if (node.literalType === 'char') {
        return `'${node.value}'`;
      }

      if (node.literalType === 'null') {
        return 'NULL';
      }

      // Numeric literal
      let result;
      if (node.literalType === 'hex') {
        result = `0x${node.value.toString(16).toUpperCase()}`;
      } else {
        result = String(node.value);
      }

      if (node.suffix) {
        result += node.suffix;
      }

      return result;
    }

    emitIdentifier(node) {
      // Handle JavaScript keywords that should be NULL in C
      if (node.name === 'undefined' || node.name === 'null')
        return 'NULL';
      // Safety check: replace any 'undefined' or 'null' in the name
      const name = node.name;
      if (name && (name.includes('undefined') || name.includes('null')))
        return name.replace(/\bundefined\b/g, 'NULL').replace(/\bnull\b/g, 'NULL');
      return name;
    }

    emitBinaryExpression(node) {
      // Wrap operands in parentheses if they are binary expressions
      // This ensures correct evaluation order since C has different precedence than JavaScript
      let left = this.emit(node.left);
      let right = this.emit(node.right);

      // Add parentheses around complex operands to ensure correct precedence
      if (node.left && node.left.nodeType === 'BinaryExpression')
        left = `(${left})`;
      if (node.right && node.right.nodeType === 'BinaryExpression')
        right = `(${right})`;

      return `${left} ${node.operator} ${right}`;
    }

    emitUnaryExpression(node) {
      const operand = this.emit(node.operand);

      if (node.isPrefix) {
        return `${node.operator}${operand}`;
      } else {
        return `${operand}${node.operator}`;
      }
    }

    emitAssignment(node) {
      const target = this.emit(node.target);
      // Handle struct initializer assignment - requires compound literal in C99+
      if (node.value && node.value.nodeType === 'StructInitializer') {
        const structInit = this.emitStructInitializer(node.value);
        // Check if target is a pointer (member access with ->) and use dereference for type
        // For pointer targets, __typeof__(target) returns pointer type, but we need struct type
        // Use __typeof__(*target) to get the pointed-to struct type for compound literal
        const isPointerTarget = target.includes('->') ||
          (node.target.nodeType === 'Identifier' && node.targetType && node.targetType.isPointer);
        if (isPointerTarget) {
          // For pointer targets: allocate new struct and assign
          // ptr = &(__typeof__(*ptr)){...} or ptr = malloc + assign
          // Use compound literal with address-of for stack allocation (simpler, works for local scope)
          return `*${target} ${node.operator} (__typeof__(*${target}))${structInit}`;
        }
        // For non-pointer targets, use direct __typeof__
        return `${target} ${node.operator} (__typeof__(${target}))${structInit}`;
      }
      return `${target} ${node.operator} ${this.emit(node.value)}`;
    }

    emitMemberAccess(node) {
      const op = node.isPointer ? '->' : '.';
      return `${this.emit(node.target)}${op}${node.member}`;
    }

    emitArraySubscript(node) {
      let index = this.emit(node.index);
      if (typeof index === 'string') {
        index = index.trim();
      }
      return `${this.emit(node.array)}[${index}]`;
    }

    emitCall(node) {
      const callee = typeof node.callee === 'string' ? node.callee : this.emit(node.callee);
      const args = node.arguments.map(a => this.emit(a));
      return `${callee}(${args.join(', ')})`;
    }

    emitCast(node) {
      return `(${this.emit(node.type)})${this.emit(node.expression)}`;
    }

    emitSizeof(node) {
      if (node.isType) {
        return `sizeof(${this.emit(node.target)})`;
      } else {
        return `sizeof ${this.emit(node.target)}`;
      }
    }

    emitConditional(node) {
      return `${this.emit(node.condition)} ? ${this.emit(node.thenExpression)} : ${this.emit(node.elseExpression)}`;
    }

    emitArrayInitializer(node) {
      const elements = node.elements.map(e => this.emit(e));
      return `{${elements.join(', ')}}`;
    }

    emitCompoundLiteral(node) {
      // Use toCompoundLiteralString() to include array brackets after type
      const typeStr = node.type.toCompoundLiteralString
        ? node.type.toCompoundLiteralString()
        : this.emitType(node.type);
      const initStr = this.emit(node.initializer);
      return `(${typeStr})${initStr}`;
    }

    emitStructInitializer(node) {
      if (node.fields.length === 0) {
        return '{0}';
      }

      const fields = node.fields.map(f => `.${f.name} = ${this.emit(f.value)}`);
      return `{${fields.join(', ')}}`;
    }

    emitComma(node) {
      const expressions = node.expressions.map(e => this.emit(e));
      return `(${expressions.join(', ')})`;
    }

    emitType(node) {
      return node.toString();
    }

    // ========================[ DOCUMENTATION ]========================

    emitComment(node) {
      if (this.options.addComments === false) {
        return '';
      }

      if (node.isBlock) {
        const lines = node.text.split('\n');
        let code = this.line('/*');
        for (const line of lines) {
          code += this.line(' * ' + line.trim());
        }
        code += this.line(' */');
        return code;
      } else {
        return this.line('// ' + node.text);
      }
    }
  }

  // Export
  const exports = { CEmitter };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.CEmitter = CEmitter;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
