/**
 * IL64BitTransformer.js - 64-bit Integer Pattern Detection and IL AST Generation
 *
 * This module detects JavaScript patterns that represent 64-bit integers as:
 * - Two-element arrays: [low, high] or [high, low]
 * - Objects with properties: {low, high} or {l, h}
 *
 * It transforms these patterns into IL AST nodes that can be emitted as native
 * 64-bit integers for languages that support them (C, Rust, Go, Java, C#, etc.)
 * or preserved as the original pattern for languages that don't (JavaScript, Python).
 *
 * Detected patterns:
 * - rotl64(val, positions) / rotr64(val, positions) → IL64BitRotate
 * - xor64(a, b) → IL64BitXor
 * - add64(a, b) / add64(aLow, aHigh, bLow, bHigh) → IL64BitAdd
 * - const [low, high] = val → IL64BitUnpack
 * - [low, high] → IL64BitPack
 * - val[0], val[1] access on 64-bit value → IL64BitLow, IL64BitHigh
 */

(function(global) {
  'use strict';

  // ============== IL 64-Bit AST Node Types ==============

  /**
   * IL64BitValue - Represents a 64-bit integer value
   * Can be created from:
   * - A pair [low, high] (two 32-bit parts)
   * - A native 64-bit value
   * - A BigInt literal
   */
  const IL64BitValue = {
    /**
     * Create from low/high 32-bit pair
     */
    fromPair(low, high) {
      return {
        type: 'IL64BitValue',
        representation: 'pair',
        low,   // AST expression for low 32 bits
        high   // AST expression for high 32 bits
      };
    },

    /**
     * Create from a single expression (e.g., a variable holding [low, high])
     */
    fromExpression(expr) {
      return {
        type: 'IL64BitValue',
        representation: 'expression',
        expression: expr
      };
    },

    /**
     * Create from a BigInt literal
     */
    fromBigInt(value) {
      return {
        type: 'IL64BitValue',
        representation: 'literal',
        value: value // BigInt or string representation
      };
    }
  };

  /**
   * IL64BitRotateLeft - 64-bit left rotation
   */
  function IL64BitRotateLeft(value, positions) {
    return {
      type: 'IL64BitRotateLeft',
      value,      // IL64BitValue or expression
      positions   // Number or expression for rotation amount
    };
  }

  /**
   * IL64BitRotateRight - 64-bit right rotation
   */
  function IL64BitRotateRight(value, positions) {
    return {
      type: 'IL64BitRotateRight',
      value,
      positions
    };
  }

  /**
   * IL64BitXor - 64-bit XOR operation
   */
  function IL64BitXor(left, right) {
    return {
      type: 'IL64BitXor',
      left,   // IL64BitValue or expression
      right   // IL64BitValue or expression
    };
  }

  /**
   * IL64BitAnd - 64-bit AND operation
   */
  function IL64BitAnd(left, right) {
    return {
      type: 'IL64BitAnd',
      left,
      right
    };
  }

  /**
   * IL64BitOr - 64-bit OR operation
   */
  function IL64BitOr(left, right) {
    return {
      type: 'IL64BitOr',
      left,
      right
    };
  }

  /**
   * IL64BitNot - 64-bit NOT operation
   */
  function IL64BitNot(value) {
    return {
      type: 'IL64BitNot',
      value
    };
  }

  /**
   * IL64BitAdd - 64-bit addition
   */
  function IL64BitAdd(left, right) {
    return {
      type: 'IL64BitAdd',
      left,
      right
    };
  }

  /**
   * IL64BitSub - 64-bit subtraction
   */
  function IL64BitSub(left, right) {
    return {
      type: 'IL64BitSub',
      left,
      right
    };
  }

  /**
   * IL64BitMul - 64-bit multiplication
   */
  function IL64BitMul(left, right) {
    return {
      type: 'IL64BitMul',
      left,
      right
    };
  }

  /**
   * IL64BitShiftLeft - 64-bit left shift
   */
  function IL64BitShiftLeft(value, positions) {
    return {
      type: 'IL64BitShiftLeft',
      value,
      positions
    };
  }

  /**
   * IL64BitShiftRight - 64-bit logical right shift
   */
  function IL64BitShiftRight(value, positions) {
    return {
      type: 'IL64BitShiftRight',
      value,
      positions
    };
  }

  /**
   * IL64BitUnpack - Extract low and high 32-bit parts from 64-bit value
   * Represents: const [low, high] = val64;
   */
  function IL64BitUnpack(value, lowVar, highVar) {
    return {
      type: 'IL64BitUnpack',
      value,      // The 64-bit value to unpack
      lowVar,     // Variable name for low 32 bits
      highVar     // Variable name for high 32 bits
    };
  }

  /**
   * IL64BitPack - Combine low and high 32-bit parts into 64-bit value
   * Represents: [low, high] or (high << 32) | low
   */
  function IL64BitPack(low, high) {
    return {
      type: 'IL64BitPack',
      low,
      high
    };
  }

  /**
   * IL64BitLow - Extract low 32 bits from 64-bit value
   */
  function IL64BitLow(value) {
    return {
      type: 'IL64BitLow',
      value
    };
  }

  /**
   * IL64BitHigh - Extract high 32 bits from 64-bit value
   */
  function IL64BitHigh(value) {
    return {
      type: 'IL64BitHigh',
      value
    };
  }

  /**
   * IL64BitVariable - Declares a variable as 64-bit type
   */
  function IL64BitVariable(name, initializer) {
    return {
      type: 'IL64BitVariable',
      name,
      initializer  // Optional initial value (IL64BitValue or expression)
    };
  }

  // ============== Pattern Detection ==============

  /**
   * Detects if a function is a 64-bit operation helper
   * Returns the operation type if detected, null otherwise
   */
  function detectFunction64BitPattern(node) {
    if (node.type !== 'FunctionDeclaration' && node.type !== 'FunctionExpression')
      return null;

    const name = node.id?.name || '';
    const body = node.body?.body || [];

    // Detect rotl64/rotr64 pattern
    if (/^_?rotl?64$/i.test(name) || /^_?rotate.*64/i.test(name)) {
      return {
        type: 'rotl64',
        params: node.params.map(p => p.name),
        originalNode: node
      };
    }

    if (/^_?rotr?64$/i.test(name)) {
      return {
        type: 'rotr64',
        params: node.params.map(p => p.name),
        originalNode: node
      };
    }

    // Detect xor64 pattern
    if (/^_?xor64$/i.test(name)) {
      return {
        type: 'xor64',
        params: node.params.map(p => p.name),
        originalNode: node
      };
    }

    // Detect add64 pattern
    if (/^_?add64$/i.test(name)) {
      return {
        type: 'add64',
        params: node.params.map(p => p.name),
        originalNode: node
      };
    }

    // Detect sub64 pattern
    if (/^_?sub64$/i.test(name)) {
      return {
        type: 'sub64',
        params: node.params.map(p => p.name),
        originalNode: node
      };
    }

    return null;
  }

  /**
   * Detects if a call expression is a 64-bit operation
   */
  function detectCall64BitPattern(node) {
    if (node.type !== 'CallExpression')
      return null;

    const calleeName = node.callee?.name ||
                       (node.callee?.type === 'MemberExpression' && node.callee.property?.name);

    if (!calleeName)
      return null;

    // Match common 64-bit function names
    const patterns = {
      rotl64: /^_?rotl?64$/i,
      rotr64: /^_?rotr?64$/i,
      xor64: /^_?xor64$/i,
      add64: /^_?add64$/i,
      sub64: /^_?sub64$/i,
      and64: /^_?and64$/i,
      or64: /^_?or64$/i,
      not64: /^_?not64$/i,
      shl64: /^_?shl64$/i,
      shr64: /^_?shr64$/i
    };

    for (const [opType, pattern] of Object.entries(patterns)) {
      if (pattern.test(calleeName)) {
        return {
          type: opType,
          arguments: node.arguments,
          originalNode: node
        };
      }
    }

    return null;
  }

  /**
   * Detects array destructuring of 64-bit value: const [low, high] = val;
   */
  function detectArrayDestructuring64Bit(node) {
    if (node.type !== 'VariableDeclaration')
      return null;

    for (const decl of node.declarations) {
      if (decl.id?.type !== 'ArrayPattern')
        continue;

      const elements = decl.id.elements;

      // Check for 2-element array pattern (common 64-bit split pattern)
      if (elements?.length === 2) {
        const [first, second] = elements;
        const firstName = first?.name?.toLowerCase() || '';
        const secondName = second?.name?.toLowerCase() || '';

        // Detect [low, high] or [l, h] pattern
        if ((firstName.includes('low') || firstName === 'l') &&
            (secondName.includes('high') || secondName === 'h')) {
          return {
            type: 'unpack64_lowhigh',
            lowVar: first.name,
            highVar: second.name,
            source: decl.init,
            originalNode: node
          };
        }

        // Detect [high, low] pattern (less common but valid)
        if ((firstName.includes('high') || firstName === 'h') &&
            (secondName.includes('low') || secondName === 'l')) {
          return {
            type: 'unpack64_highlow',
            highVar: first.name,
            lowVar: second.name,
            source: decl.init,
            originalNode: node
          };
        }
      }
    }

    return null;
  }

  /**
   * Detects array literal representing 64-bit value: [low, high]
   */
  function detectArrayLiteral64Bit(node, context) {
    if (node.type !== 'ArrayExpression')
      return null;

    if (node.elements?.length !== 2)
      return null;

    // Check context - is this being returned from a 64-bit function or assigned to a 64-bit variable?
    // For now, we rely on naming conventions in the elements

    const [first, second] = node.elements;

    // Check if element names suggest low/high pattern
    const getVarName = (elem) => elem?.name || elem?.property?.name || '';
    const firstName = getVarName(first).toLowerCase();
    const secondName = getVarName(second).toLowerCase();

    if ((firstName.includes('low') || firstName === 'l') &&
        (secondName.includes('high') || secondName === 'h')) {
      return {
        type: 'pack64_lowhigh',
        low: first,
        high: second,
        originalNode: node
      };
    }

    return null;
  }

  // ============== AST Transformer ==============

  /**
   * Transform 64-bit patterns in AST to IL nodes
   */
  class IL64BitASTTransformer {
    constructor(options = {}) {
      this.options = {
        // Whether to transform to IL nodes (true) or preserve original (false)
        transform: true,
        // Track detected 64-bit functions for call site transformation
        detected64BitFunctions: new Map(),
        ...options
      };
    }

    /**
     * Transform an AST, detecting and converting 64-bit patterns
     */
    transform(ast) {
      if (!ast || !ast.body)
        return ast;

      // First pass: detect 64-bit function declarations
      this._detectFunctions(ast);

      // Second pass: transform call sites and patterns
      return this._transformNode(ast);
    }

    _detectFunctions(ast) {
      const visit = (node) => {
        if (!node) return;

        const pattern = detectFunction64BitPattern(node);
        if (pattern) {
          this.options.detected64BitFunctions.set(
            node.id?.name || '',
            pattern
          );
        }

        // Recurse
        for (const key of Object.keys(node)) {
          const child = node[key];
          if (Array.isArray(child)) {
            child.forEach(visit);
          } else if (child && typeof child === 'object' && child.type) {
            visit(child);
          }
        }
      };

      visit(ast);
    }

    _transformNode(node) {
      if (!node)
        return node;

      // Transform specific node types
      switch (node.type) {
        case 'CallExpression':
          return this._transformCallExpression(node);

        case 'VariableDeclaration':
          return this._transformVariableDeclaration(node);

        case 'ArrayExpression':
          return this._transformArrayExpression(node);

        case 'FunctionDeclaration':
        case 'FunctionExpression':
          return this._transformFunctionDeclaration(node);
      }

      // Recurse for other node types
      for (const key of Object.keys(node)) {
        const child = node[key];
        if (Array.isArray(child)) {
          node[key] = child.map(c => this._transformNode(c));
        } else if (child && typeof child === 'object' && child.type) {
          node[key] = this._transformNode(child);
        }
      }

      return node;
    }

    _transformCallExpression(node) {
      const pattern = detectCall64BitPattern(node);
      if (!pattern)
        return this._recurseNode(node);

      // Transform arguments first
      const args = node.arguments.map(a => this._transformNode(a));

      switch (pattern.type) {
        case 'rotl64':
          return IL64BitRotateLeft(args[0], args[1]);

        case 'rotr64':
          return IL64BitRotateRight(args[0], args[1]);

        case 'xor64':
          return IL64BitXor(args[0], args[1]);

        case 'add64':
          // Handle both add64(a, b) and add64(aLow, aHigh, bLow, bHigh) forms
          if (args.length === 2) {
            return IL64BitAdd(args[0], args[1]);
          } else if (args.length === 4) {
            return IL64BitAdd(
              IL64BitPack(args[0], args[1]),
              IL64BitPack(args[2], args[3])
            );
          }
          break;

        case 'sub64':
          return IL64BitSub(args[0], args[1]);

        case 'and64':
          return IL64BitAnd(args[0], args[1]);

        case 'or64':
          return IL64BitOr(args[0], args[1]);

        case 'not64':
          return IL64BitNot(args[0]);

        case 'shl64':
          return IL64BitShiftLeft(args[0], args[1]);

        case 'shr64':
          return IL64BitShiftRight(args[0], args[1]);
      }

      return this._recurseNode(node);
    }

    _transformVariableDeclaration(node) {
      const pattern = detectArrayDestructuring64Bit(node);
      if (!pattern)
        return this._recurseNode(node);

      const source = this._transformNode(pattern.source);

      return IL64BitUnpack(source, pattern.lowVar, pattern.highVar);
    }

    _transformArrayExpression(node) {
      const pattern = detectArrayLiteral64Bit(node);
      if (!pattern)
        return this._recurseNode(node);

      const low = this._transformNode(pattern.low);
      const high = this._transformNode(pattern.high);

      return IL64BitPack(low, high);
    }

    _transformFunctionDeclaration(node) {
      const pattern = detectFunction64BitPattern(node);

      // Transform the function body
      const transformedBody = this._transformNode(node.body);

      if (pattern) {
        // Mark this function as a 64-bit helper (for potential removal/inlining)
        return {
          ...node,
          body: transformedBody,
          _is64BitHelper: true,
          _64BitType: pattern.type
        };
      }

      return {
        ...node,
        body: transformedBody
      };
    }

    _recurseNode(node) {
      for (const key of Object.keys(node)) {
        const child = node[key];
        if (Array.isArray(child)) {
          node[key] = child.map(c => this._transformNode(c));
        } else if (child && typeof child === 'object' && child.type) {
          node[key] = this._transformNode(child);
        }
      }
      return node;
    }
  }

  // ============== Exports ==============

  const IL64Bit = {
    // Node constructors
    Value: IL64BitValue,
    RotateLeft: IL64BitRotateLeft,
    RotateRight: IL64BitRotateRight,
    Xor: IL64BitXor,
    And: IL64BitAnd,
    Or: IL64BitOr,
    Not: IL64BitNot,
    Add: IL64BitAdd,
    Sub: IL64BitSub,
    Mul: IL64BitMul,
    ShiftLeft: IL64BitShiftLeft,
    ShiftRight: IL64BitShiftRight,
    Unpack: IL64BitUnpack,
    Pack: IL64BitPack,
    Low: IL64BitLow,
    High: IL64BitHigh,
    Variable: IL64BitVariable,

    // Pattern detection
    detectFunction64BitPattern,
    detectCall64BitPattern,
    detectArrayDestructuring64Bit,
    detectArrayLiteral64Bit,

    // Transformer
    ASTTransformer: IL64BitASTTransformer
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = IL64Bit;
  }

  global.IL64Bit = IL64Bit;

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
