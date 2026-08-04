/*
 * DMC (Dynamic Markov Compression) Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * DMC predicts each input *bit* using a finite-state Markov model and codes
 * it with a binary arithmetic coder. The model starts as a small fixed
 * automaton and grows adaptively: whenever a transition (state, bit) has
 * been used often enough, and the state it leads to is also used
 * significantly by other paths, that destination state is "cloned" into a
 * private copy dedicated to this transition (with its statistics split
 * proportionally). This lets the model specialize its context over time
 * without ever needing a full reset.
 *
 * Initial model: 16 states arranged as two 8-state chains (one reached after
 * a 0-bit, one after a 1-bit), cycling once per byte. From state s (chain c,
 * position p = s mod 8), the 0-edge leads to position (p+1 mod 8) of chain 0
 * and the 1-edge leads to position (p+1 mod 8) of chain 1; every count starts
 * at 1 (a uniform prior). This is the same "two-chain" starting automaton
 * commonly used to introduce DMC, generalized to a byte-oriented context.
 *
 * Reference:
 *   G. V. Cormack and R. N. S. Horspool, "Data Compression Using Dynamic
 *   Markov Modelling", The Computer Journal, Vol. 30, No. 6, 1987,
 *   pp. 541-550.
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

  // ===== ALGORITHM IMPLEMENTATION =====

  const INITIAL_STATES = 16;
  const CLONE_THRESHOLD_USED = 2;  // r: minimum count on the used edge
  const CLONE_THRESHOLD_OTHER = 2; // targetTotal - r: minimum "other" usage of the target
  const MAX_STATES = 4096;         // bound on model growth

  // ----- Markov model shared by the encoder and the decoder -----

  class DmcModel {
    constructor() {
      this.n0 = [];
      this.n1 = [];
      this.next0 = [];
      this.next1 = [];
      this.count = 0;

      for (let s = 0; s < INITIAL_STATES; s++) {
        const pos = s % 8;
        const newPos = (pos + 1) % 8;
        this.next0.push(newPos);       // 0-edge lands in chain 0
        this.next1.push(8 + newPos);   // 1-edge lands in chain 1
        this.n0.push(1);
        this.n1.push(1);
        this.count++;
      }
    }

    // Probability that the next bit is 1, given the current state.
    predictP1(state) {
      const total = this.n0[state] + this.n1[state];
      return this.n1[state] / total;
    }

    // Advances the model after observing `bit` from `state`, performing a
    // clone when warranted, and returns the new current state.
    step(state, bit) {
      if (bit === 0) this.n0[state] = this.n0[state] + 1;
      else this.n1[state] = this.n1[state] + 1;

      const r = bit === 0 ? this.n0[state] : this.n1[state];
      const target = bit === 0 ? this.next0[state] : this.next1[state];
      const targetTotal = this.n0[target] + this.n1[target];

      if (this.count < MAX_STATES && r >= CLONE_THRESHOLD_USED && (targetTotal - r) >= CLONE_THRESHOLD_OTHER) {
        const clone = this.count++;
        const n0New = Math.max(1, Math.round(this.n0[target] * r / targetTotal));
        const n1New = Math.max(1, Math.round(this.n1[target] * r / targetTotal));

        this.next0.push(this.next0[target]);
        this.next1.push(this.next1[target]);
        this.n0.push(n0New);
        this.n1.push(n1New);

        this.n0[target] = Math.max(1, this.n0[target] - n0New);
        this.n1[target] = Math.max(1, this.n1[target] - n1New);

        if (bit === 0) this.next0[state] = clone;
        else this.next1[state] = clone;

        return clone;
      }

      return target;
    }
  }

  // ----- Binary arithmetic coder (Witten-Neal-Cleary style 32-bit coder,
  //       specialized to a single adaptive probability per decision) -----

  class BinaryArithmeticEncoder {
    constructor() {
      this.low = 0;
      this.high = 0xFFFFFFFF;
      this.followBits = 0;
      this.bits = [];
      this.QUARTER = 0x40000000;
      this.HALF = 0x80000000;
      this.THREE_QUARTERS = 0xC0000000;
    }

    encodeBit(p1, bit) {
      const range = this.high - this.low + 1;
      const mid = this.low + Math.floor(range * (1 - p1)) - 1;

      if (bit === 0) this.high = mid;
      else this.low = mid + 1;

      while (true) {
        if (this.high < this.HALF) {
          this._outputBit(0);
        } else if (this.low >= this.HALF) {
          this._outputBit(1);
          this.low -= this.HALF;
          this.high -= this.HALF;
        } else if (this.low >= this.QUARTER && this.high < this.THREE_QUARTERS) {
          this.followBits++;
          this.low -= this.QUARTER;
          this.high -= this.QUARTER;
        } else {
          break;
        }

        this.low = OpCodes.ToUint32(OpCodes.Shl32(this.low, 1));
        this.high = OpCodes.ToUint32(OpCodes.Or32(OpCodes.Shl32(this.high, 1), 1));
      }
    }

    _outputBit(bit) {
      this.bits.push(bit);
      while (this.followBits > 0) {
        this.bits.push(1 - bit);
        this.followBits--;
      }
    }

    finish() {
      this.followBits++;
      if (this.low < this.QUARTER) this._outputBit(0);
      else this._outputBit(1);
      return this.bits;
    }
  }

  class BinaryArithmeticDecoder {
    constructor(bits) {
      this.bits = bits;
      this.pos = 0;
      this.low = 0;
      this.high = 0xFFFFFFFF;
      this.value = 0;
      this.QUARTER = 0x40000000;
      this.HALF = 0x80000000;
      this.THREE_QUARTERS = 0xC0000000;

      for (let i = 0; i < 32; i++) {
        this.value = OpCodes.ToUint32(OpCodes.Or32(OpCodes.Shl32(this.value, 1), this._nextBit()));
      }
    }

    _nextBit() {
      return this.pos < this.bits.length ? this.bits[this.pos++] : 0;
    }

    decodeBit(p1) {
      const range = this.high - this.low + 1;
      const mid = this.low + Math.floor(range * (1 - p1)) - 1;

      let bit;
      if (this.value <= mid) {
        bit = 0;
        this.high = mid;
      } else {
        bit = 1;
        this.low = mid + 1;
      }

      while (true) {
        if (this.high < this.HALF) {
          // no-op: interval already in lower half
        } else if (this.low >= this.HALF) {
          this.low -= this.HALF;
          this.high -= this.HALF;
          this.value -= this.HALF;
        } else if (this.low >= this.QUARTER && this.high < this.THREE_QUARTERS) {
          this.low -= this.QUARTER;
          this.high -= this.QUARTER;
          this.value -= this.QUARTER;
        } else {
          break;
        }

        this.low = OpCodes.ToUint32(OpCodes.Shl32(this.low, 1));
        this.high = OpCodes.ToUint32(OpCodes.Or32(OpCodes.Shl32(this.high, 1), 1));
        this.value = OpCodes.ToUint32(OpCodes.Or32(OpCodes.Shl32(this.value, 1), this._nextBit()));
      }

      return bit;
    }
  }

  /**
 * DMCCompression - Dynamic Markov Compression algorithm
 * @class
 * @extends {CompressionAlgorithm}
 */

  class DMCCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "DMC";
        this.description = "Dynamic Markov Compression. Predicts each bit with an adaptive finite-state Markov model and codes it with a binary arithmetic coder; the model grows by cloning states that are shared by multiple significant paths, specializing context without a full reset.";
        this.inventor = "Gordon V. Cormack, R. Nigel S. Horspool";
        this.year = 1987;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Context Modeling";
        this.securityStatus = null;
        this.complexity = ComplexityType.EXPERT;
        this.country = CountryCode.CA;

        // Documentation and references
        this.documentation = [
          new LinkItem("Data Compression Using Dynamic Markov Modelling (Cormack and Horspool, 1987)", "https://doi.org/10.1093/comjnl/30.6.541"),
          new LinkItem("Dynamic Markov compression - Wikipedia", "https://en.wikipedia.org/wiki/Dynamic_Markov_compression"),
          new LinkItem("Arithmetic coding - Wikipedia", "https://en.wikipedia.org/wiki/Arithmetic_coding")
        ];

        this.references = [
          new LinkItem("A bit-level context modeling and arithmetic coding overview", "https://www.cs.cmu.edu/~aberger/pdf/dmc.pdf"),
          new LinkItem("Data Compression: The Complete Reference (Salomon)", "https://www.springer.com/gp/book/9781846286025")
        ];

        // Test vectors - self-computed round-trip verification vectors produced
        // by this implementation (DMC's compressed output is inherently
        // implementation-defined - it depends on the exact initial automaton,
        // clone thresholds, and arithmetic coder precision, none of which the
        // original paper fixes precisely).
        this.tests = [
          {
            text: "Empty input",
            uri: "https://en.wikipedia.org/wiki/Boundary_condition",
            input: [],
            expected: []
          },
          {
            text: "Repetitive input - 'AAAAAAAAAA'",
            uri: "https://doi.org/10.1093/comjnl/30.6.541",
            input: OpCodes.AsciiToBytes("AAAAAAAAAA"),
            expected: [0,0,0,10,0,0,0,29,65,48,8,152]
          },
          {
            text: "Text sample - 'the quick brown fox'",
            uri: "https://doi.org/10.1093/comjnl/30.6.541",
            input: OpCodes.AsciiToBytes("the quick brown fox"),
            expected: [0,0,0,19,0,0,0,139,116,108,63,145,148,104,2,85,113,84,102,18,249,173,224,231,60,224]
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new DMCInstance(this, isInverse);
      }
    }

    class DMCInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
      }

      Result() {
        if (this.inputBuffer.length === 0) return [];

        const result = this.isInverse ? this._decompress(this.inputBuffer) : this._compress(this.inputBuffer);
        this.inputBuffer = [];
        return result;
      }

      _compress(data) {
        const model = new DmcModel();
        const encoder = new BinaryArithmeticEncoder();
        let state = 0;

        for (let i = 0; i < data.length; i++) {
          const byte = data[i];
          for (let b = 7; b >= 0; b--) {
            const bit = OpCodes.And32(OpCodes.Shr32(byte, b), 1);
            const p1 = model.predictP1(state);
            encoder.encodeBit(p1, bit);
            state = model.step(state, bit);
          }
        }

        const bits = encoder.finish();

        const packed = [];
        let cur = 0, nbits = 0;
        for (let i = 0; i < bits.length; i++) {
          cur = OpCodes.Or32(OpCodes.Shl32(cur, 1), bits[i]);
          nbits++;
          if (nbits === 8) { packed.push(OpCodes.ToByte(cur)); cur = 0; nbits = 0; }
        }
        if (nbits > 0) { packed.push(OpCodes.ToByte(OpCodes.Shl32(cur, 8 - nbits))); }

        const output = [];
        { const _src = OpCodes.Unpack32BE(data.length); for (let _i = 0; _i < _src.length; _i++) output.push(_src[_i]); }
        { const _src = OpCodes.Unpack32BE(bits.length); for (let _i = 0; _i < _src.length; _i++) output.push(_src[_i]); }
        for (let _i = 0; _i < packed.length; _i++) output.push(packed[_i]);
        return output;
      }

      _decompress(data) {
        if (data.length < 8) return [];

        const originalLength = OpCodes.Pack32BE(data[0], data[1], data[2], data[3]);
        const bitLen = OpCodes.Pack32BE(data[4], data[5], data[6], data[7]);
        if (originalLength === 0) return [];

        const bits = [];
        for (let i = 0; i < bitLen; i++) {
          const byteIndex = 8 + Math.floor(i / 8);
          const bitIndex = 7 - (i % 8);
          const byteVal = byteIndex < data.length ? data[byteIndex] : 0;
          bits.push(OpCodes.And32(OpCodes.Shr32(byteVal, bitIndex), 1));
        }

        const decoder = new BinaryArithmeticDecoder(bits);
        const model = new DmcModel();
        let state = 0;
        const out = [];

        for (let i = 0; i < originalLength; i++) {
          let byte = 0;
          for (let b = 0; b < 8; b++) {
            const p1 = model.predictP1(state);
            const bit = decoder.decodeBit(p1);
            state = model.step(state, bit);
            byte = OpCodes.Or32(OpCodes.Shl32(byte, 1), bit);
          }
          out.push(OpCodes.ToByte(byte));
        }

        return out;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new DMCCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DMCCompression, DMCInstance };
}));
