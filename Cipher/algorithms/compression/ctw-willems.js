/*
 * Context Tree Weighting (Willems) Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * A clean-room implementation of the Context Tree Weighting (CTW) method: a
 * bounded-depth binary context tree in which every node holds a
 * Krichevsky-Trofimov (KT) probability estimator, and the coding probability
 * of each node is the recursive equal-weight mixture of that node's own KT
 * estimate and the product of its two children's weighted probabilities.
 * The resulting per-bit probability drives a binary arithmetic coder.
 *
 * Implemented from the published description in Willems, Shtarkov and
 * Tjalkens, "The Context-Tree Weighting Method: Basic Properties", IEEE
 * Transactions on Information Theory, vol. 41, no. 3, May 1995.
 *
 * KT estimator: at a node that has observed a zeros and b ones, the
 * KT-estimated probability of the next symbol follows the standard
 * recurrence Pe(a+1,b)/Pe(a,b) = (a+0.5)/(a+b+1) for a zero and the
 * symmetric form for a one, starting from Pe(0,0)=1.
 *
 * Recursive weighting: for a node s at depth d < D with children s0 and s1
 * (reached by prepending the next, deeper context bit), the weighted
 * probability is Pw(s) = (1/2) Pe(s) + (1/2) Pw(s0) Pw(s1) - an equal prior
 * between "this context is deep enough" and "split one level deeper". Nodes
 * at the maximum depth D have no children, so Pw = Pe there.
 *
 * Context and depth: the context tree operates directly on the message's
 * bit sequence (MSB-first per byte); the context of a bit is the preceding
 * CONTEXT_DEPTH_BITS bits, so the root is the order-0 (no context) node and
 * the deepest nodes correspond to a two-byte binary history. All orders from
 * 0 to 16 are mixed simultaneously by the recursion above - CTW's defining
 * property, unlike a fixed-order model where no single order is chosen
 * ahead of time. History bits before the start of the message are treated
 * as zero (a fixed, deterministic convention applied identically by encoder
 * and decoder).
 *
 * Coding: for each bit, the two hypothetical root weighted probabilities
 * (assuming the next bit is 0, and assuming it is 1) are computed without
 * mutating the tree; because the KT estimator and the CTW mixture are both
 * proper, P(bit=1) reduces to a direct ratio of the two hypothetical
 * values. That probability feeds a binary arithmetic coder; only afterwards
 * is the tree updated with the actual bit.
 *
 * This is NOT the "Context Predictor (order-2/1/0)" registered by ctw.js,
 * which despite its historic filename is an unrelated most-frequent-symbol
 * predictor with no relation to the CTW method described above.
 */


(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== BINARY ARITHMETIC CODER =====
  // Ported from Compression.Core.Entropy.Arithmetic.{ArithmeticEncoder,ArithmeticDecoder}:
  // a 30-bit-precision bit-level arithmetic coder with the classic
  // Witten/Neal/Cleary underflow (E3) handling.

  const AC_PRECISION_BITS = 30;
  const AC_FULL_RANGE = OpCodes.Shl32(1, AC_PRECISION_BITS);
  const AC_HALF_RANGE = OpCodes.Shl32(1, AC_PRECISION_BITS - 1);
  const AC_QUARTER_RANGE = OpCodes.Shl32(1, AC_PRECISION_BITS - 2);

  class ArithmeticEncoder {
    constructor(output) {
      this.output = output;
      this.low = 0;
      this.high = AC_FULL_RANGE - 1;
      this.pendingBits = 0;
      this.bitBuffer = 0;
      this.bitsInBuffer = 0;
    }

    encodeBit(bit, prob0) {
      const range = this.high - this.low + 1;
      const mid = this.low + Math.floor((range * prob0) / 65536) - 1;

      if (bit === 0) this.high = mid;
      else this.low = mid + 1;

      this._normalize();
    }

    finish() {
      this.pendingBits++;
      this._writeBitAndPending(this.low >= AC_QUARTER_RANGE ? 1 : 0);

      if (this.bitsInBuffer > 0) {
        this.bitBuffer = OpCodes.Shl32(this.bitBuffer, 8 - this.bitsInBuffer);
        this.output.push(OpCodes.And32(this.bitBuffer, 0xFF));
      }
    }

    _normalize() {
      for (;;) {
        if (this.high < AC_HALF_RANGE) {
          this._writeBitAndPending(0);
        } else if (this.low >= AC_HALF_RANGE) {
          this._writeBitAndPending(1);
          this.low -= AC_HALF_RANGE;
          this.high -= AC_HALF_RANGE;
        } else if (this.low >= AC_QUARTER_RANGE && this.high < 3 * AC_QUARTER_RANGE) {
          this.pendingBits++;
          this.low -= AC_QUARTER_RANGE;
          this.high -= AC_QUARTER_RANGE;
        } else {
          break;
        }

        this.low = OpCodes.Shl32(this.low, 1);
        this.high = OpCodes.Or32(OpCodes.Shl32(this.high, 1), 1);
      }
    }

    _writeBitAndPending(bit) {
      this._writeBit(bit);
      const opposite = 1 - bit;
      while (this.pendingBits > 0) {
        this._writeBit(opposite);
        this.pendingBits--;
      }
    }

    _writeBit(bit) {
      this.bitBuffer = OpCodes.Or32(OpCodes.Shl32(this.bitBuffer, 1), bit);
      this.bitsInBuffer++;
      if (this.bitsInBuffer !== 8) return;

      this.output.push(OpCodes.And32(this.bitBuffer, 0xFF));
      this.bitBuffer = 0;
      this.bitsInBuffer = 0;
    }
  }

  class ArithmeticDecoder {
    constructor(input) {
      this.input = input;
      this.pos = 0;
      this.low = 0;
      this.high = AC_FULL_RANGE - 1;
      this.bitBuffer = 0;
      this.bitsRemaining = 0;

      this.code = 0;
      for (let i = 0; i < AC_PRECISION_BITS; ++i) this.code = OpCodes.Or32(OpCodes.Shl32(this.code, 1), this._readBit());
    }

    decodeBit(prob0) {
      const range = this.high - this.low + 1;
      const mid = this.low + Math.floor((range * prob0) / 65536) - 1;

      let bit;
      if (this.code <= mid) {
        bit = 0;
        this.high = mid;
      } else {
        bit = 1;
        this.low = mid + 1;
      }

      this._normalize();
      return bit;
    }

    _normalize() {
      for (;;) {
        if (this.high < AC_HALF_RANGE) {
          // both in lower half - just shift
        } else if (this.low >= AC_HALF_RANGE) {
          this.low -= AC_HALF_RANGE;
          this.high -= AC_HALF_RANGE;
          this.code -= AC_HALF_RANGE;
        } else if (this.low >= AC_QUARTER_RANGE && this.high < 3 * AC_QUARTER_RANGE) {
          this.low -= AC_QUARTER_RANGE;
          this.high -= AC_QUARTER_RANGE;
          this.code -= AC_QUARTER_RANGE;
        } else {
          break;
        }

        this.low = OpCodes.Shl32(this.low, 1);
        this.high = OpCodes.Or32(OpCodes.Shl32(this.high, 1), 1);
        this.code = OpCodes.Or32(OpCodes.Shl32(this.code, 1), this._readBit());
      }
    }

    _readBit() {
      if (this.bitsRemaining === 0) {
        this.bitBuffer = this.pos < this.input.length ? this.input[this.pos++] : 0;
        this.bitsRemaining = 8;
      }

      this.bitsRemaining--;
      return OpCodes.And32(OpCodes.Shr32(this.bitBuffer, this.bitsRemaining), 1);
    }
  }

  // ===== CONTEXT TREE WEIGHTING MODEL =====

  const CONTEXT_DEPTH_BITS = 16;
  const LOG_HALF = -0.6931471805599453; // Math.log(0.5)

  function logAddExp(a, b) {
    if (a > b) return a + Math.log(1.0 + Math.exp(b - a));
    return b + Math.log(1.0 + Math.exp(a - b));
  }

  class CtwNode {
    constructor() {
      this.count0 = 0;
      this.count1 = 0;
      this.logPe = 0;
      this.logPw = 0;
      this.child0 = null;
      this.child1 = null;
    }
  }

  class CtwTree {
    constructor(depth) {
      this.depth = depth;
      this.historyMask = OpCodes.Shl32(1, depth) - 1;
      this.root = new CtwNode();
      this.path = new Array(depth + 1).fill(null);
      this.logPe0 = new Array(depth + 1).fill(0);
      this.logPe1 = new Array(depth + 1).fill(0);
      this.logPw0 = new Array(depth + 1).fill(0);
      this.logPw1 = new Array(depth + 1).fill(0);
      this.history = 0;
    }

    predictProbabilityOfOne() {
      // Phase 1: materialise the path root..leaf for the current context.
      this.path[0] = this.root;
      let cur = this.root;
      for (let level = 1; level <= this.depth; ++level) {
        const contextBit = OpCodes.And32(OpCodes.Shr32(this.history, level - 1), 1);
        if (contextBit === 0) {
          if (!cur.child0) cur.child0 = new CtwNode();
          cur = cur.child0;
        } else {
          if (!cur.child1) cur.child1 = new CtwNode();
          cur = cur.child1;
        }
        this.path[level] = cur;
      }

      // Phase 2: per-node hypothetical KT increments (own counts only).
      for (let level = 0; level <= this.depth; ++level) {
        const node = this.path[level];
        const total = node.count0 + node.count1;
        this.logPe0[level] = node.logPe + Math.log((node.count0 + 0.5) / (total + 1));
        this.logPe1[level] = node.logPe + Math.log((node.count1 + 0.5) / (total + 1));
      }

      // Phase 3: bottom-up recursive weighting, reusing cached sibling Pw.
      this.logPw0[this.depth] = this.logPe0[this.depth];
      this.logPw1[this.depth] = this.logPe1[this.depth];
      for (let level = this.depth - 1; level >= 0; --level) {
        const node = this.path[level];
        const child = this.path[level + 1];
        const sibling = child === node.child0 ? node.child1 : node.child0;
        const siblingLogPw = sibling ? sibling.logPw : 0.0;

        this.logPw0[level] = logAddExp(this.logPe0[level] + LOG_HALF, this.logPw0[level + 1] + siblingLogPw + LOG_HALF);
        this.logPw1[level] = logAddExp(this.logPe1[level] + LOG_HALF, this.logPw1[level + 1] + siblingLogPw + LOG_HALF);
      }

      const logPwRoot0 = this.logPw0[0];
      const logPwRoot1 = this.logPw1[0];
      return 1.0 / (1.0 + Math.exp(logPwRoot0 - logPwRoot1));
    }

    update(bit) {
      for (let level = 0; level <= this.depth; ++level) {
        const node = this.path[level];
        if (bit === 0) {
          node.logPe = this.logPe0[level];
          node.logPw = this.logPw0[level];
          node.count0++;
        } else {
          node.logPe = this.logPe1[level];
          node.logPw = this.logPw1[level];
          node.count1++;
        }
      }

      this.history = OpCodes.And32(OpCodes.Or32(OpCodes.Shl32(this.history, 1), bit), this.historyMask);
    }
  }

  function toProb0(p1) {
    const prob0 = Math.round((1.0 - p1) * 65536.0);
    return Math.max(1, Math.min(65535, prob0));
  }

  // ===== CTW (WILLEMS) CODEC =====

  function ctwCompress(data) {
    const output = [];
    output.push(...OpCodes.Unpack32LE(data.length));

    if (data.length === 0) return output;

    const encoder = new ArithmeticEncoder(output);
    const tree = new CtwTree(CONTEXT_DEPTH_BITS);

    for (const value of data) {
      for (let bit = 7; bit >= 0; --bit) {
        const bitVal = OpCodes.And32(OpCodes.Shr32(value, bit), 1);
        const p1 = tree.predictProbabilityOfOne();
        const prob0 = toProb0(p1);
        encoder.encodeBit(bitVal, prob0);
        tree.update(bitVal);
      }
    }

    encoder.finish();
    return output;
  }

  function ctwDecompress(data) {
    const size = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
    if (size === 0) return [];

    const decoder = new ArithmeticDecoder(data.slice(4));
    const tree = new CtwTree(CONTEXT_DEPTH_BITS);

    const result = new Array(size);
    for (let i = 0; i < size; ++i) {
      let value = 0;
      for (let bit = 7; bit >= 0; --bit) {
        const p1 = tree.predictProbabilityOfOne();
        const prob0 = toProb0(p1);
        const bitVal = decoder.decodeBit(prob0);
        tree.update(bitVal);
        value = OpCodes.Or32(OpCodes.Shl32(value, 1), bitVal);
      }
      result[i] = value;
    }

    return result;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * CTWWillemsAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class CTWWillemsAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Context Tree Weighting (Willems)";
        this.description = "Genuine Context Tree Weighting (Willems/Shtarkov/Tjalkens): a depth-16 binary context tree with a Krichevsky-Trofimov estimator per node, recursively weighted between each node's own estimate and the product of its children, driving a binary arithmetic coder. Distinct from \"Context Predictor (order-2/1/0)\" in ctw.js, which despite its historic filename is an unrelated most-frequent-symbol predictor.";
        this.inventor = "Frans Willems, Yuri Shtarkov, Tjalling Tjalkens";
        this.year = 1995;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Context Mixing";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.NL; // Netherlands

        // Documentation and references
        this.documentation = [
          new LinkItem("Context Tree Weighting - Wikipedia", "https://en.wikipedia.org/wiki/Context_tree_weighting"),
          new LinkItem("The Context-Tree Weighting Method: Basic Properties (IEEE)", "https://ieeexplore.ieee.org/document/382012")
        ];

        this.references = [
          new LinkItem("The Context-Tree Weighting Method", "https://pure.tue.nl/ws/portalfiles/portal/1134430/200411859.pdf"),
          new LinkItem("Krichevsky-Trofimov Estimator", "https://en.wikipedia.org/wiki/Krichevsky%E2%80%93Trofimov_estimator"),
          new LinkItem("Data Compression Course", "https://web.stanford.edu/class/ee398a/")
        ];

        // Test vectors - cross-checked byte-for-byte against the CompressionWorkbench
        // (C#) BB_ContextTreeWeighting reference implementation, which this
        // model and coder follow.
        this.tests = [
          new TestCase(
            [],
            OpCodes.Hex8ToBytes("00000000"),
            "Empty input",
            "https://en.wikipedia.org/wiki/Context_tree_weighting"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("A"),
            OpCodes.Hex8ToBytes("010000006280"),
            "Single byte literal",
            "https://en.wikipedia.org/wiki/Context_tree_weighting"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("AB"),
            OpCodes.Hex8ToBytes("0200000062cf00"),
            "Two bytes",
            "https://en.wikipedia.org/wiki/Context_tree_weighting"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("Hello World"),
            OpCodes.Hex8ToBytes("0b00000066312f2a8b787dd38a2b3780"),
            "Text with no repetition",
            "https://en.wikipedia.org/wiki/Context_tree_weighting"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. "),
            OpCodes.Hex8ToBytes("b400000077578191c1ef6951402bbff40fe06e7fad93efe76eb8f98e1d9de8bb6a368862d7cdf641fdba96d3defdd4704484af640788b71c09c0defd04d4ebfe1e479d281c4c77864b08fd5b071433592a699635b9714ef58ca147a1bdb6360a763ad1d9a0d36fd82886b218"),
            "Repeated text sample (4x)",
            "https://en.wikipedia.org/wiki/Context_tree_weighting"
          ),
          new TestCase(
            (function() { const a = []; for (let i = 0; i < 256; ++i) a.push(0x61); return a; })(),
            OpCodes.Hex8ToBytes("0001000070e865c932a56d"),
            "256 repeated bytes",
            "https://en.wikipedia.org/wiki/Context_tree_weighting"
          ),
          new TestCase(
            (function() { const a = []; for (let i = 0; i < 256; ++i) a.push(i); return a; })(),
            OpCodes.Hex8ToBytes("00010000244b9e5f41569b1e4e74c0ae47a08ce9844e4ff26153655c8e96877c32b6d6f2e2308caf9d1470a06095d867ab488e38112ff7ab7038045b6bce6523f3d4ed553fea0742b6ccee68d88a2b84dbe426a05baf3fcd1915d8c61e74c765d811aee4761fcaccdacadeca2048cf588a33b95cf6da11191ee82fd0b73b902e361414051a2ab69535750770e3aa87a8f931505e83499781db15079bef6b3fbe0c529ae1b3a59e1115cf497f26e0622e3a9e04e26e57ada7c636750366618ecc8ba5708e4bb4b7d7bb759631dbf0b80e8f4d4b3da35b3ba43c7839136dc9b75ca1f59c6ef00571d5c49012ce86d13d0f26ae03cc282eb90f18fc1d41c6bdbfa3fc2a41afa0"),
            "All 256 byte values",
            "https://en.wikipedia.org/wiki/Context_tree_weighting"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new CTWWillemsInstance(this, isInverse);
      }
    }

    class CTWWillemsInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse; // true = decompress, false = compress
        this.inputBuffer = [];
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer.push(...data);
      }

      Result() {
        const result = this.isInverse ?
          ctwDecompress(this.inputBuffer) :
          ctwCompress(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new CTWWillemsAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { CTWWillemsAlgorithm, CTWWillemsInstance };
}));
