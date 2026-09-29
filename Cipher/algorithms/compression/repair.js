/*
 * RePair (Recursive Pairing) Grammar Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * RePair builds a context-free grammar that generates exactly the input
 * sequence once and only once, by repeatedly replacing the most frequent
 * pair of adjacent symbols with a new grammar rule.
 *
 * Reference:
 *   N. J. Larsson and A. Moffat, "Off-Line Dictionary-Based Compression",
 *   Proceedings of the IEEE, Vol. 88, No. 11, November 2000, pp. 1722-1732.
 *   (Originally presented at Data Compression Conference, 1999.)
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

  /**
 * RePairCompression - Recursive pairing grammar compression algorithm
 * @class
 * @extends {CompressionAlgorithm}
 */

  class RePairCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "RePair";
        this.description = "Recursive pairing grammar compression. Repeatedly replaces the most frequent adjacent symbol pair with a new grammar rule until no pair repeats, producing a straight-line context-free grammar that generates the input exactly once.";
        this.inventor = "N. Jesper Larsson, Alistair Moffat";
        this.year = 1999;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Grammar-based";
        this.securityStatus = null;
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.SE;

        // Documentation and references
        this.documentation = [
          new LinkItem("Off-Line Dictionary-Based Compression (IEEE Proceedings)", "https://ieeexplore.ieee.org/document/892708"),
          new LinkItem("RePair - Wikipedia (Grammar-based codes)", "https://en.wikipedia.org/wiki/Grammar-based_code"),
          new LinkItem("Data Compression Conference 1999 paper", "https://doi.org/10.1109/DCC.1999.755678")
        ];

        this.references = [
          new LinkItem("Larsson and Moffat original DCC'99 slides/paper", "https://people.eng.unimelb.edu.au/ammoffat/abstracts/lm99dcc.html"),
          new LinkItem("Grammar-based compression survey", "https://en.wikipedia.org/wiki/Straight-line_grammar")
        ];

        // Test vectors - round-trip compression tests only. The serialized byte
        // layout matches CompressionWorkbench's RePairBuildingBlock (the reference
        // implementation this port is verified against byte-for-byte), but is
        // otherwise implementation-defined, so vectors here only assert round-trip
        // correctness rather than fixed compressed bytes.
        this.tests = [
          {
            text: "Empty input",
            uri: "https://en.wikipedia.org/wiki/Boundary_condition",
            input: [],
            expected: []
          },
          {
            text: "Single repeated pair - 'aaaa' (RePair Wikipedia style example)",
            uri: "https://en.wikipedia.org/wiki/Grammar-based_code",
            input: OpCodes.AsciiToBytes("aaaa"),
            expected: []
          },
          {
            text: "Repetitive text - 'abcabcabc'",
            uri: "https://en.wikipedia.org/wiki/Grammar-based_code",
            input: OpCodes.AsciiToBytes("abcabcabc"),
            expected: []
          },
          {
            text: "No repeated pairs - 'abcdef'",
            uri: "Edge case - grammar reduces to zero rules",
            input: OpCodes.AsciiToBytes("abcdef"),
            expected: []
          }
        ];
      }

      /**
       * Create a new instance
       * @param {boolean} [isInverse=false] - True to decompress
       * @returns {RePairInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new RePairInstance(this, isInverse);
      }
    }

    /** @type {int32} */
    const FIRST_NON_TERMINAL = 256;

    /**
     * Pair registry, occurrence heaps and candidate queue of one RePair run.
     *
     * The sequence lives in a doubly linked list over the original slot numbers,
     * so a slot's number never changes and list order is always slot order.
     * Pair ids are handed out in order of first appearance; the (left, right) to
     * id lookup is an open-addressing hash table whose layout never influences
     * which id a pair gets.
     */
    class RePairGrammar {
      /**
       * @param {int32[]} symbol - Symbol per slot (-1 once fused away)
       * @param {int32[]} nextSlot - Following slot, -1 at the end
       */
      constructor(symbol, nextSlot) {
        /** @type {int32[]} */
        this.symbol = symbol;
        /** @type {int32[]} */
        this.nextSlot = nextSlot;

        /** @type {int32[]} */
        this.pairLeft = [];
        /** @type {int32[]} */
        this.pairRight = [];
        /** @type {int32[]} */
        this.pairCount = [];
        /** @type {int32[][]} */
        this.pairOccurrences = []; // per pair: binary min-heap of slot numbers
        /** @type {int32[]} */
        this.pairTouched = [];

        /** @type {int32[]} */
        this.lookup = new Int32Array(1024).fill(-1);
        /** @type {int32} */
        this.lookupMask = 1023;

        /** @type {int32} */
        this.round = 0;
        /** @type {int32[]} */
        this.touched = [];

        /** @type {int32[]} */
        this.queueCount = [];
        /** @type {int32[]} */
        this.queueSlot = [];
        /** @type {int32[]} */
        this.queuePair = [];
      }

      /**
       * @param {int32} left - Left symbol
       * @param {int32} right - Right symbol
       * @returns {int32} Hash table bucket
       */
      _bucket(left, right) {
        /** @type {uint32} */
        const h = OpCodes.Xor32(OpCodes.Mul32(left, 0x9E3779B1), OpCodes.Mul32(right, 0x85EBCA77));
        return OpCodes.And32(OpCodes.Xor32(h, OpCodes.Shr32(h, 15)), this.lookupMask);
      }

      /** Double the hash table and re-insert every pair id */
      _grow() {
        /** @type {int32} */
        const size = (this.lookupMask + 1) * 2;
        this.lookup = new Int32Array(size).fill(-1);
        this.lookupMask = size - 1;
        for (let id = 0; id < this.pairLeft.length; id++) {
          /** @type {int32} */
          let bucket = this._bucket(this.pairLeft[id], this.pairRight[id]);
          while (this.lookup[bucket] !== -1) {
            bucket = OpCodes.And32(bucket + 1, this.lookupMask);
          }
          this.lookup[bucket] = id;
        }
      }

      /**
       * @param {int32} left - Left symbol
       * @param {int32} right - Right symbol
       * @returns {int32} Id of the pair, registered on first sight
       */
      pairIdOf(left, right) {
        /** @type {int32} */
        let bucket = this._bucket(left, right);
        for (;;) {
          /** @type {int32} */
          const found = this.lookup[bucket];
          if (found === -1) {
            break;
          }
          if (this.pairLeft[found] === left && this.pairRight[found] === right) {
            return found;
          }
          bucket = OpCodes.And32(bucket + 1, this.lookupMask);
        }

        /** @type {int32} */
        const id = this.pairLeft.length;
        this.lookup[bucket] = id;
        this.pairLeft.push(left);
        this.pairRight.push(right);
        this.pairCount.push(0);
        /** @type {int32[]} */
        const heap = [];
        this.pairOccurrences.push(heap);
        this.pairTouched.push(-1);
        if (this.pairLeft.length * 2 > this.lookupMask) {
          this._grow();
        }
        return id;
      }

      /**
       * @param {int32} id - Pair id
       */
      markTouched(id) {
        if (this.pairTouched[id] === this.round) {
          return;
        }
        this.pairTouched[id] = this.round;
        this.touched.push(id);
      }

      // Occurrences are only ever added, never deleted: once a slot stops
      // holding a given pair it can never hold that pair again, because the
      // left symbol of a slot only ever grows and the following slot only
      // changes when that left symbol is replaced. Stale heap entries are
      // therefore discarded on sight when the minimum is read.
      /**
       * @param {int32} id - Pair id
       * @param {int32} slot - Slot holding the pair
       */
      pushOccurrence(id, slot) {
        /** @type {int32[]} */
        const heap = this.pairOccurrences[id];
        heap.push(slot);
        /** @type {int32} */
        let child = heap.length - 1;
        while (child > 0) {
          /** @type {int32} */
          const parent = Math.floor((child - 1) / 2);
          if (heap[parent] <= heap[child]) {
            break;
          }
          /** @type {int32} */
          const swap = heap[parent];
          heap[parent] = heap[child];
          heap[child] = swap;
          child = parent;
        }
      }

      /**
       * @param {int32[]} heap - Occurrence heap losing its minimum
       */
      dropOccurrenceTop(heap) {
        /** @type {int32} */
        const last = heap.length - 1;
        heap[0] = heap[last];
        heap.pop();
        /** @type {int32} */
        const size = heap.length;
        /** @type {int32} */
        let parent = 0;
        for (;;) {
          /** @type {int32} */
          const leftChild = parent * 2 + 1;
          /** @type {int32} */
          const rightChild = leftChild + 1;
          /** @type {int32} */
          let best = parent;
          if (leftChild < size && heap[leftChild] < heap[best]) {
            best = leftChild;
          }
          if (rightChild < size && heap[rightChild] < heap[best]) {
            best = rightChild;
          }
          if (best === parent) {
            break;
          }
          /** @type {int32} */
          const swap = heap[best];
          heap[best] = heap[parent];
          heap[parent] = swap;
          parent = best;
        }
      }

      /**
       * @param {int32} id - Pair id
       * @returns {int32} Smallest slot still holding the pair, -1 when none
       */
      earliestOccurrence(id) {
        /** @type {int32[]} */
        const heap = this.pairOccurrences[id];
        /** @type {int32} */
        const left = this.pairLeft[id];
        /** @type {int32} */
        const right = this.pairRight[id];
        while (heap.length > 0) {
          /** @type {int32} */
          const slot = heap[0];
          /** @type {int32} */
          const after = this.nextSlot[slot];
          if (this.symbol[slot] === left && after !== -1 && this.symbol[after] === right) {
            return slot;
          }
          this.dropOccurrenceTop(heap);
        }
        return -1;
      }

      /**
       * @param {int32} left - Left symbol
       * @param {int32} right - Right symbol
       * @param {int32} slot - Slot of the left symbol
       */
      addPair(left, right, slot) {
        /** @type {int32} */
        const id = this.pairIdOf(left, right);
        this.pairCount[id]++;
        this.pushOccurrence(id, slot);
        this.markTouched(id);
      }

      /**
       * @param {int32} left - Left symbol
       * @param {int32} right - Right symbol
       */
      removePair(left, right) {
        /** @type {int32} */
        const id = this.pairIdOf(left, right);
        this.pairCount[id]--;
        this.markTouched(id);
      }

      // ----- candidate queue, ordered by count then by earliest slot -----

      /**
       * @param {int32} a - Queue index
       * @param {int32} b - Queue index
       * @returns {boolean} True when entry a comes before entry b
       */
      queueBefore(a, b) {
        if (this.queueCount[a] !== this.queueCount[b]) {
          return this.queueCount[a] > this.queueCount[b];
        }
        return this.queueSlot[a] < this.queueSlot[b];
      }

      /**
       * @param {int32} a - Queue index
       * @param {int32} b - Queue index
       */
      queueSwap(a, b) {
        /** @type {int32} */
        let swap = this.queueCount[a];
        this.queueCount[a] = this.queueCount[b];
        this.queueCount[b] = swap;
        swap = this.queueSlot[a];
        this.queueSlot[a] = this.queueSlot[b];
        this.queueSlot[b] = swap;
        swap = this.queuePair[a];
        this.queuePair[a] = this.queuePair[b];
        this.queuePair[b] = swap;
      }

      /**
       * @param {int32} count - Occurrence count
       * @param {int32} slot - Earliest slot
       * @param {int32} id - Pair id
       */
      queuePush(count, slot, id) {
        this.queueCount.push(count);
        this.queueSlot.push(slot);
        this.queuePair.push(id);
        /** @type {int32} */
        let child = this.queueCount.length - 1;
        while (child > 0) {
          /** @type {int32} */
          const parent = Math.floor((child - 1) / 2);
          if (!this.queueBefore(child, parent)) {
            break;
          }
          this.queueSwap(child, parent);
          child = parent;
        }
      }

      /** Remove the first queue entry */
      queuePop() {
        /** @type {int32} */
        const last = this.queueCount.length - 1;
        this.queueSwap(0, last);
        this.queueCount.pop();
        this.queueSlot.pop();
        this.queuePair.pop();
        /** @type {int32} */
        const size = this.queueCount.length;
        /** @type {int32} */
        let parent = 0;
        for (;;) {
          /** @type {int32} */
          const leftChild = parent * 2 + 1;
          /** @type {int32} */
          const rightChild = leftChild + 1;
          /** @type {int32} */
          let best = parent;
          if (leftChild < size && this.queueBefore(leftChild, best)) {
            best = leftChild;
          }
          if (rightChild < size && this.queueBefore(rightChild, best)) {
            best = rightChild;
          }
          if (best === parent) {
            break;
          }
          this.queueSwap(best, parent);
          parent = best;
        }
      }

      // A queue entry describes a pair as it was when the entry was made. Every
      // pair whose occurrences changed during a round is re-published at the end
      // of that round, so each eligible pair always has one entry stating its
      // current count and earliest slot; entries that no longer state the truth
      // are stale and are discarded when they surface.
      publishTouched() {
        for (let i = 0; i < this.touched.length; i++) {
          /** @type {int32} */
          const id = this.touched[i];
          if (this.pairCount[id] < 2) {
            continue;
          }
          /** @type {int32} */
          const earliest = this.earliestOccurrence(id);
          this.queuePush(this.pairCount[id], earliest, id);
        }
        this.touched.length = 0;
        this.round++;
      }

      /**
       * @returns {int32} Pair to replace next, -1 when no pair occurs twice
       */
      selectPair() {
        while (this.queueCount.length > 0) {
          /** @type {int32} */
          const id = this.queuePair[0];
          if (this.queueCount[0] !== this.pairCount[id]) {
            this.queuePop();
            continue;
          }
          /** @type {int32} */
          const earliest = this.earliestOccurrence(id);
          if (this.queueSlot[0] !== earliest) {
            this.queuePop();
            continue;
          }
          return id;
        }
        return -1;
      }
    }

    class RePairInstance extends IAlgorithmInstance {
      /**
       * @param {RePairCompression} algorithm - Parent algorithm
       * @param {boolean} [isInverse=false] - True to decompress
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        /** @type {boolean} */
        this.isInverse = isInverse;
        /** @type {uint8[]} */
        this.inputBuffer = [];
      }

      /**
       * Compress or decompress the collected input
       * @returns {uint8[]} Output bytes
       */
      Result() {
        if (this.isInverse) {
          // A compressed stream always carries at least the 4-byte header, so an
          // empty buffer here is not a valid compressed empty message.
          if (this.inputBuffer.length === 0) {
            /** @type {uint8[]} */
            const empty = [];
            return empty;
          }
          /** @type {uint8[]} */
          const decoded = this._decompress();
          return decoded;
        }

        // Compressing empty input still emits the header (matches
        // CompressionWorkbench, which never skips the container).
        /** @type {uint8[]} */
        const encoded = this._compress();
        return encoded;
      }

      // ----- Compression: build a straight-line grammar via recursive pairing -----
      //
      // Matches CompressionWorkbench's RePairBuildingBlock.Compress byte-for-byte.
      // Pair frequencies are counted once and then maintained incrementally:
      // replacing a pair only disturbs the two neighbouring positions, so a round
      // costs work proportional to the substitutions it makes rather than to the
      // sequence length. Larsson and Moffat, "Off-Line Dictionary-Based
      // Compression", 2000.
      //
      // SELECTION ORDER - total, explicit, and identical in both languages:
      //   1. Highest occurrence count wins, counting every adjacent position
      //      including overlapping ones ("aaa" contains the pair (a,a) twice).
      //   2. Ties are broken by the smallest slot number at which the pair occurs,
      //      i.e. the pair that appears earliest in the current sequence.
      //   3. A pair must occur at least twice to be eligible at all.
      // Nothing is left to a container's iteration order.
      //
      // Substitution is the same non-overlapping left-to-right scan as before: a
      // replaced pair is fused into its left slot and scanning resumes at the slot
      // that followed the pair.

      /**
       * @returns {uint8[]} Header, rules and final sequence
       */
      _compress() {
        /** @type {uint8[]} */
        const data = this.inputBuffer;
        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;

        // Symbols are written to the stream as 16-bit values, and rule r is
        // referred to as FIRST_NON_TERMINAL + r, so the last rule that can be
        // named is 65535 - 256. The former limit of 65536 let rule numbers run
        // past what the wire format can express: they wrapped on serialisation
        // and the stream decoded to the wrong bytes with nothing raised. Stopping
        // here costs a little ratio on inputs that would exceed it and changes
        // no output that was previously decodable.
        /** @type {int32} */
        const MAX_RULES = 65536 - FIRST_NON_TERMINAL;

        /** @type {int32} */
        const length = data.length;
        /** @type {uint8[]} */
        const output = OpCodes.Unpack32LE(OpCodes.ToUint32(length));

        if (length === 0) {
          return output;
        }

        //#region sequence as a doubly linked list over slot numbers

        /** @type {int32[]} */
        const symbol = new Int32Array(length);
        /** @type {int32[]} */
        const nextSlot = new Int32Array(length);
        /** @type {int32[]} */
        const previousSlot = new Int32Array(length);
        for (let slot = 0; slot < length; slot++) {
          symbol[slot] = data[slot];
          nextSlot[slot] = slot + 1 < length ? slot + 1 : -1;
          previousSlot[slot] = slot - 1;
        }

        //#endregion

        /** @type {RePairGrammar} */
        const grammar = new RePairGrammar(symbol, nextSlot);

        for (let slot = 0; slot + 1 < length; slot++) {
          grammar.addPair(symbol[slot], symbol[slot + 1], slot);
        }
        grammar.publishTouched();

        /** @type {int32[][]} */
        const rules = [];
        /** @type {int32} */
        let remaining = length;

        while (rules.length < MAX_RULES) {
          /** @type {int32} */
          const winner = grammar.selectPair();
          if (winner < 0) {
            break;
          }

          /** @type {int32} */
          const left = grammar.pairLeft[winner];
          /** @type {int32} */
          const right = grammar.pairRight[winner];
          /** @type {int32} */
          const newSymbol = FIRST_NON_TERMINAL + rules.length;
          rules.push([left, right]);

          // The surviving occurrences of the winning pair are exactly the ones
          // this loop has not consumed, and they always lie to the right of the
          // slot just fused, so taking them in ascending slot order reproduces
          // the non-overlapping left-to-right scan without walking the sequence.
          for (;;) {
            /** @type {int32} */
            const slot = grammar.earliestOccurrence(winner);
            if (slot === -1) {
              break;
            }
            /** @type {int32} */
            const partner = nextSlot[slot];

            /** @type {int32} */
            const before = previousSlot[slot];
            /** @type {int32} */
            const after = nextSlot[partner];

            if (before !== -1) {
              grammar.removePair(symbol[before], symbol[slot]);
            }
            grammar.removePair(left, right);
            if (after !== -1) {
              grammar.removePair(symbol[partner], symbol[after]);
            }

            symbol[slot] = newSymbol;
            symbol[partner] = -1;
            nextSlot[slot] = after;
            if (after !== -1) {
              previousSlot[after] = slot;
            }
            remaining--;

            if (before !== -1) {
              grammar.addPair(symbol[before], newSymbol, before);
            }
            if (after !== -1) {
              grammar.addPair(newSymbol, symbol[after], slot);
            }
          }

          grammar.publishTouched();
        }

        // Serialize: rule count (4-byte LE); each rule as (left,right), both
        // 2-byte LE; final sequence length (4-byte LE); each symbol, 2-byte LE.
        this._pushBytes(output, OpCodes.Unpack32LE(rules.length));

        for (let r = 0; r < rules.length; r++) {
          /** @type {int32[]} */
          const rule = rules[r];
          this._pushBytes(output, OpCodes.Unpack16LE(rule[0]));
          this._pushBytes(output, OpCodes.Unpack16LE(rule[1]));
        }

        this._pushBytes(output, OpCodes.Unpack32LE(remaining));

        for (let slot = 0; slot !== -1; slot = nextSlot[slot]) {
          this._pushBytes(output, OpCodes.Unpack16LE(symbol[slot]));
        }

        return output;
      }

      /**
       * @private
       * @param {uint8[]} output - Destination
       * @param {uint8[]} bytes - Bytes appended
       */
      _pushBytes(output, bytes) {
        for (let i = 0; i < bytes.length; i++) {
          output.push(bytes[i]);
        }
      }

      // ----- Decompression: expand the grammar rules back into the byte sequence -----

      /**
       * @returns {uint8[]} Decoded bytes
       */
      _decompress() {
        /** @type {uint8[]} */
        const data = this.inputBuffer;
        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;

        /** @type {uint32} */
        const originalSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
        /** @type {uint8[]} */
        const result = [];
        if (originalSize === 0) {
          return result;
        }

        /** @type {int32} */
        let offset = 4;

        /** @type {uint32} */
        const ruleCount = OpCodes.Pack32LE(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
        offset += 4;

        /** @type {int32[][]} */
        const rules = new Array(ruleCount);
        for (let i = 0; i < ruleCount; i++) {
          /** @type {uint16} */
          const left = OpCodes.Pack16LE(data[offset], data[offset + 1]);
          /** @type {uint16} */
          const right = OpCodes.Pack16LE(data[offset + 2], data[offset + 3]);
          rules[i] = [left, right];
          offset += 4;
        }

        /** @type {uint32} */
        const seqLength = OpCodes.Pack32LE(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
        offset += 4;

        /** @type {int32[]} */
        const stack = [];

        for (let i = 0; i < seqLength; i++) {
          /** @type {uint16} */
          const sym = OpCodes.Pack16LE(data[offset], data[offset + 1]);
          offset += 2;

          // Expand symbol iteratively via an explicit stack: pushing right then
          // left means left pops (and expands) first, giving correct left-to-right
          // grammar expansion.
          stack.push(sym);
          while (stack.length > 0) {
            /** @type {int32} */
            const s = stack.pop();
            if (s < FIRST_NON_TERMINAL) {
              result.push(s);
            } else {
              /** @type {int32[]} */
              const rule = rules[s - FIRST_NON_TERMINAL];
              stack.push(rule[1]);
              stack.push(rule[0]);
            }
          }
        }

        return result;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new RePairCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RePairCompression, RePairInstance };
}));
