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

      CreateInstance(isInverse = false) {
        return new RePairInstance(this, isInverse);
      }
    }

    class RePairInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
      }


      Result() {
        if (this.isInverse) {
          // A compressed stream always carries at least the 4-byte header, so an
          // empty buffer here is not a valid compressed empty message.
          if (this.inputBuffer.length === 0) return [];
          return this._decompress();
        }

        // Compressing empty input still emits the header (matches
        // CompressionWorkbench, which never skips the container).
        return this._compress();
      }

      // ----- Compression: build a straight-line grammar via recursive pairing -----
      //
      // Matches CompressionWorkbench's RePairBuildingBlock.Compress byte-for-byte.
      // The sequence lives in a doubly linked list over the original slot numbers,
      // so a slot's number never changes and list order is always slot order. Pair
      // frequencies are counted once and then maintained incrementally: replacing a
      // pair only disturbs the two neighbouring positions, so a round costs work
      // proportional to the substitutions it makes rather than to the sequence
      // length. Larsson and Moffat, "Off-Line Dictionary-Based Compression", 2000.
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

      _compress() {
        const data = this.inputBuffer;
        this.inputBuffer = [];

        const FIRST_NON_TERMINAL = 256;
        // Symbols are written to the stream as 16-bit values, and rule r is
        // referred to as FIRST_NON_TERMINAL + r, so the last rule that can be
        // named is 65535 - 256. The former limit of 65536 let rule numbers run
        // past what the wire format can express: they wrapped on serialisation
        // and the stream decoded to the wrong bytes with nothing raised. Stopping
        // here costs a little ratio on inputs that would exceed it and changes
        // no output that was previously decodable.
        const MAX_RULES = 65536 - FIRST_NON_TERMINAL;
        // Packs (left, right) into one Number key. Both symbols are always
        // < 2^17, so this is exact (no precision loss) and preserves distinctness
        // the same way the reference's 64-bit key does.
        const PACK_BASE = 131072;

        const length = data.length;
        const output = OpCodes.Unpack32LE(OpCodes.ToUint32(length));

        if (length === 0) return output;

        //#region sequence as a doubly linked list over slot numbers

        const symbol = new Int32Array(length);
        const nextSlot = new Int32Array(length);
        const previousSlot = new Int32Array(length);
        for (let slot = 0; slot < length; slot++) {
          symbol[slot] = data[slot];
          nextSlot[slot] = slot + 1 < length ? slot + 1 : -1;
          previousSlot[slot] = slot - 1;
        }

        //#endregion

        //#region pair registry

        const pairIndex = new Map();
        const pairLeft = [];
        const pairRight = [];
        const pairCount = [];
        const pairOccurrences = [];   // per pair: binary min-heap of slot numbers
        const pairTouched = [];

        const pairIdOf = (left, right) => {
          const key = left * PACK_BASE + right;
          let id = pairIndex.get(key);
          if (id === undefined) {
            id = pairLeft.length;
            pairIndex.set(key, id);
            pairLeft.push(left);
            pairRight.push(right);
            pairCount.push(0);
            pairOccurrences.push([]);
            pairTouched.push(-1);
          }
          return id;
        };

        let round = 0;
        const touched = [];
        const markTouched = id => {
          if (pairTouched[id] === round) return;
          pairTouched[id] = round;
          touched.push(id);
        };

        // Occurrences are only ever added, never deleted: once a slot stops
        // holding a given pair it can never hold that pair again, because the
        // left symbol of a slot only ever grows and the following slot only
        // changes when that left symbol is replaced. Stale heap entries are
        // therefore discarded on sight when the minimum is read.
        const pushOccurrence = (id, slot) => {
          const heap = pairOccurrences[id];
          heap.push(slot);
          let child = heap.length - 1;
          while (child > 0) {
            const parent = Math.floor((child - 1) / 2);
            if (heap[parent] <= heap[child]) break;
            const swap = heap[parent]; heap[parent] = heap[child]; heap[child] = swap;
            child = parent;
          }
        };

        const dropOccurrenceTop = heap => {
          const last = heap.length - 1;
          heap[0] = heap[last];
          heap.pop();
          const size = heap.length;
          let parent = 0;
          for (;;) {
            const leftChild = parent * 2 + 1;
            const rightChild = leftChild + 1;
            let best = parent;
            if (leftChild < size && heap[leftChild] < heap[best]) best = leftChild;
            if (rightChild < size && heap[rightChild] < heap[best]) best = rightChild;
            if (best === parent) break;
            const swap = heap[best]; heap[best] = heap[parent]; heap[parent] = swap;
            parent = best;
          }
        };

        const earliestOccurrence = id => {
          const heap = pairOccurrences[id];
          const left = pairLeft[id];
          const right = pairRight[id];
          while (heap.length > 0) {
            const slot = heap[0];
            const after = nextSlot[slot];
            if (symbol[slot] === left && after !== -1 && symbol[after] === right) return slot;
            dropOccurrenceTop(heap);
          }
          return -1;
        };

        const addPair = (left, right, slot) => {
          const id = pairIdOf(left, right);
          pairCount[id]++;
          pushOccurrence(id, slot);
          markTouched(id);
        };

        const removePair = (left, right) => {
          const id = pairIdOf(left, right);
          pairCount[id]--;
          markTouched(id);
        };

        //#endregion

        //#region candidate queue, ordered by count then by earliest slot

        const queueCount = [];
        const queueSlot = [];
        const queuePair = [];

        const queueBefore = (a, b) => queueCount[a] !== queueCount[b]
          ? queueCount[a] > queueCount[b]
          : queueSlot[a] < queueSlot[b];

        const queueSwap = (a, b) => {
          let swap = queueCount[a]; queueCount[a] = queueCount[b]; queueCount[b] = swap;
          swap = queueSlot[a]; queueSlot[a] = queueSlot[b]; queueSlot[b] = swap;
          swap = queuePair[a]; queuePair[a] = queuePair[b]; queuePair[b] = swap;
        };

        const queuePush = (count, slot, id) => {
          queueCount.push(count);
          queueSlot.push(slot);
          queuePair.push(id);
          let child = queueCount.length - 1;
          while (child > 0) {
            const parent = Math.floor((child - 1) / 2);
            if (!queueBefore(child, parent)) break;
            queueSwap(child, parent);
            child = parent;
          }
        };

        const queuePop = () => {
          const last = queueCount.length - 1;
          queueSwap(0, last);
          queueCount.pop(); queueSlot.pop(); queuePair.pop();
          const size = queueCount.length;
          let parent = 0;
          for (;;) {
            const leftChild = parent * 2 + 1;
            const rightChild = leftChild + 1;
            let best = parent;
            if (leftChild < size && queueBefore(leftChild, best)) best = leftChild;
            if (rightChild < size && queueBefore(rightChild, best)) best = rightChild;
            if (best === parent) break;
            queueSwap(best, parent);
            parent = best;
          }
        };

        // A queue entry describes a pair as it was when the entry was made. Every
        // pair whose occurrences changed during a round is re-published at the end
        // of that round, so each eligible pair always has one entry stating its
        // current count and earliest slot; entries that no longer state the truth
        // are stale and are discarded when they surface.
        const publishTouched = () => {
          for (let i = 0; i < touched.length; i++) {
            const id = touched[i];
            if (pairCount[id] < 2) continue;
            queuePush(pairCount[id], earliestOccurrence(id), id);
          }
          touched.length = 0;
          round++;
        };

        const selectPair = () => {
          while (queueCount.length > 0) {
            const id = queuePair[0];
            if (queueCount[0] !== pairCount[id]) { queuePop(); continue; }
            if (queueSlot[0] !== earliestOccurrence(id)) { queuePop(); continue; }
            return id;
          }
          return -1;
        };

        //#endregion

        for (let slot = 0; slot + 1 < length; slot++)
          addPair(symbol[slot], symbol[slot + 1], slot);
        publishTouched();

        const rules = [];
        let remaining = length;

        while (rules.length < MAX_RULES) {
          const winner = selectPair();
          if (winner < 0) break;

          const left = pairLeft[winner];
          const right = pairRight[winner];
          const newSymbol = FIRST_NON_TERMINAL + rules.length;
          rules.push([left, right]);

          // The surviving occurrences of the winning pair are exactly the ones
          // this loop has not consumed, and they always lie to the right of the
          // slot just fused, so taking them in ascending slot order reproduces
          // the non-overlapping left-to-right scan without walking the sequence.
          for (;;) {
            const slot = earliestOccurrence(winner);
            if (slot === -1) break;
            const partner = nextSlot[slot];

            const before = previousSlot[slot];
            const after = nextSlot[partner];

            if (before !== -1) removePair(symbol[before], symbol[slot]);
            removePair(left, right);
            if (after !== -1) removePair(symbol[partner], symbol[after]);

            symbol[slot] = newSymbol;
            symbol[partner] = -1;
            nextSlot[slot] = after;
            if (after !== -1) previousSlot[after] = slot;
            remaining--;

            if (before !== -1) addPair(symbol[before], newSymbol, before);
            if (after !== -1) addPair(newSymbol, symbol[after], slot);
          }

          publishTouched();
        }

        // Serialize: rule count (4-byte LE); each rule as (left,right), both
        // 2-byte LE; final sequence length (4-byte LE); each symbol, 2-byte LE.
        { const rc = OpCodes.Unpack32LE(rules.length); output.push(rc[0], rc[1], rc[2], rc[3]); }

        for (const rule of rules) {
          const lb = OpCodes.Unpack16LE(rule[0]);
          const rb = OpCodes.Unpack16LE(rule[1]);
          output.push(lb[0], lb[1], rb[0], rb[1]);
        }

        { const sc = OpCodes.Unpack32LE(remaining); output.push(sc[0], sc[1], sc[2], sc[3]); }

        for (let slot = 0; slot !== -1; slot = nextSlot[slot]) {
          const sb = OpCodes.Unpack16LE(symbol[slot]);
          output.push(sb[0], sb[1]);
        }

        return output;
      }

      // ----- Decompression: expand the grammar rules back into the byte sequence -----

      _decompress() {
        const data = this.inputBuffer;
        this.inputBuffer = [];

        const FIRST_NON_TERMINAL = 256;

        const originalSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
        if (originalSize === 0) return [];

        let offset = 4;

        const ruleCount = OpCodes.Pack32LE(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
        offset += 4;

        const rules = new Array(ruleCount);
        for (let i = 0; i < ruleCount; i++) {
          const left = OpCodes.Pack16LE(data[offset], data[offset + 1]);
          const right = OpCodes.Pack16LE(data[offset + 2], data[offset + 3]);
          rules[i] = [left, right];
          offset += 4;
        }

        const seqLength = OpCodes.Pack32LE(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
        offset += 4;

        const result = [];
        const stack = [];

        for (let i = 0; i < seqLength; i++) {
          const sym = OpCodes.Pack16LE(data[offset], data[offset + 1]);
          offset += 2;

          // Expand symbol iteratively via an explicit stack: pushing right then
          // left means left pops (and expands) first, giving correct left-to-right
          // grammar expansion.
          stack.push(sym);
          while (stack.length > 0) {
            const s = stack.pop();
            if (s < FIRST_NON_TERMINAL) {
              result.push(s);
            } else {
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
