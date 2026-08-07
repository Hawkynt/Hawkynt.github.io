/*
 * Sequitur Grammar-Based Compression Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Sequitur infers a straight-line context-free grammar from a sequence in a
 * single left-to-right pass by continuously enforcing two invariants as each
 * symbol is appended.
 *
 * Specification source:
 *   C. G. Nevill-Manning and I. H. Witten, "Identifying Hierarchical Structure
 *   in Sequences: A Linear-Time Algorithm", Journal of Artificial Intelligence
 *   Research 7 (1997), 67-82.
 *
 * Digram uniqueness. No pair of adjacent symbols (a "digram") may occur more
 * than once anywhere across the grammar (the start sequence and every rule
 * body). The moment appending a symbol - or splicing one in as a side effect of
 * enforcing an invariant - creates a second occurrence of some digram, that
 * digram is replaced at both occurrences by a reference to a rule whose
 * two-symbol body is that digram, reusing an existing rule for the same digram
 * if one already exists.
 *
 * Rule utility. Every non-start rule must be used more than once. If a
 * substitution removes one of a rule's two remaining references, that rule is
 * eliminated: its single remaining reference is replaced in place by the rule's
 * own body ("inlining"), which in turn creates new adjacent digrams that are
 * themselves checked for uniqueness.
 *
 * A rule is created with exactly two symbols, but rule-utility elimination can
 * splice an inlined rule's body into another rule's body, so a rule body can
 * grow past two symbols by the time the grammar settles. Only the distinguished
 * start rule is unrestricted in length from the outset and exempt from the
 * rule-utility check.
 *
 * Compression is input-shaped, not guaranteed: the published complexity result
 * is that grammar size stays linear in the input, not that it is always much
 * smaller. Input with short internal periodicity collapses into a compact
 * doubling hierarchy; a longer block with no short internal periodicity,
 * repeated many times, only reaches near-linear grammar size because each new
 * repetition's leading digram matches a witness sitting inside the previous
 * repetition's rule.
 *
 * Wire format (matches CompressionWorkbench's BB_Sequitur building block):
 *   [originalLength: 4 bytes little-endian]
 *   [ruleCount: varint]
 *   [for each rule: length varint, then that many symbol varints]
 *   [start sequence: length varint, then that many symbol varints]
 * Varints are little-endian base-128 (7 payload bits per byte, high bit marks
 * continuation). Symbols below 256 are terminal bytes; 256 + i references rule
 * i. An empty input produces only the 4-byte header.
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

  // ===== SLOT-ORDERED MAP =====

  // An insertion-ordered map whose freed slots are recycled last-in-first-out,
  // so enumeration order after removals is reproducible. The serialised rule
  // order depends on this ordering, which is why a plain Map (which never
  // recycles slots) is not interchangeable here.
  class SlotMap {
    constructor() {
      this.entries = [];   // { key, value, free, nextFree }
      this.index = new Map();
      this.freeList = -1;
      this.freeCount = 0;
      this.count = 0;
    }

    get(key) {
      const slot = this.index.get(key);
      return slot === undefined ? undefined : this.entries[slot].value;
    }

    set(key, value) {
      const existing = this.index.get(key);
      if (existing !== undefined) {
        this.entries[existing].value = value;
        return;
      }

      let slot;
      if (this.freeCount > 0) {
        slot = this.freeList;
        this.freeList = this.entries[slot].nextFree;
        this.freeCount--;
      } else {
        slot = this.count;
        this.count++;
      }

      this.entries[slot] = { key: key, value: value, free: false, nextFree: -1 };
      this.index.set(key, slot);
    }

    remove(key) {
      const slot = this.index.get(key);
      if (slot === undefined) return false;

      this.index.delete(key);
      this.entries[slot] = { key: null, value: null, free: true, nextFree: this.freeList };
      this.freeList = slot;
      this.freeCount++;
      return true;
    }

    values() {
      const result = [];
      for (let i = 0; i < this.count; i++)
        if (!this.entries[i].free) result.push(this.entries[i].value);

      return result;
    }
  }

  // ===== GRAMMAR STRUCTURES =====

  let nextRuleId = 0;

  // A single occurrence of a symbol (terminal byte or non-terminal rule
  // reference) inside some rule's body, linked to its neighbours.
  class Sym {
    constructor(isTerminal, terminal, target) {
      this.isTerminal = isTerminal;
      this.terminal = terminal;
      this.target = target;
      this.prev = null;
      this.next = null;
      this.owner = null;
      // Set once this occurrence has been permanently removed from every rule
      // body, so stale entries on the pending worklist become safe no-ops
      // instead of reading invalidated neighbour pointers.
      this.dead = false;
    }
  }

  // A grammar rule: the distinguished start rule (arbitrary length, never
  // eliminated) or a digram rule (created with exactly two symbols, possibly
  // grown later by inlining, and itself eliminated by inlining if its own
  // reference count ever drops to one).
  class Rule {
    constructor() {
      this.id = nextRuleId++;
      this.first = null;
      this.last = null;
      this.referrers = new Set();
      this.isDeleted = false;
    }
  }

  function identityOf(sym) {
    return sym.isTerminal ? 'T' + sym.terminal : 'R' + sym.target.id;
  }

  function keyOf(a, b) {
    return identityOf(a) + '|' + identityOf(b);
  }

  // Builds a Sequitur grammar incrementally from appended terminal symbols,
  // maintaining digram uniqueness and rule utility after every append.
  class Grammar {
    constructor() {
      this.start = new Rule();
      this.witness = new Map();
      this.ruleByDigram = new SlotMap();
      this.pending = [];
    }

    appendTerminal(value) {
      const sym = new Sym(true, value, null);
      this._appendToTail(this.start, sym);
      this._enforce(sym.prev);
    }

    // Assigns dense indices to the surviving rules and renders the grammar as
    // (rule bodies, start sequence) using the codebook terminal = 0..255,
    // non-terminal = 256 + ruleIndex.
    finalize() {
      const liveRules = this.ruleByDigram.values();
      const index = new Map();
      for (let i = 0; i < liveRules.length; ++i) index.set(liveRules[i], i);

      const rules = [];
      for (let i = 0; i < liveRules.length; ++i) {
        const body = [];
        for (let s = liveRules[i].first; s !== null; s = s.next) body.push(Grammar._code(s, index));
        rules.push(body);
      }

      const startSequence = [];
      for (let s = this.start.first; s !== null; s = s.next) startSequence.push(Grammar._code(s, index));

      return { rules: rules, startSequence: startSequence };
    }

    static _code(sym, index) {
      return sym.isTerminal ? sym.terminal : 256 + index.get(sym.target);
    }

    _appendToTail(rule, sym) {
      sym.owner = rule;
      sym.prev = rule.last;
      sym.next = null;
      if (rule.last !== null) rule.last.next = sym; else rule.first = sym;
      rule.last = sym;
    }

    static _insertBetween(owner, prev, sym, next) {
      sym.owner = owner;
      sym.prev = prev;
      sym.next = next;
      if (prev !== null) prev.next = sym; else owner.first = sym;
      if (next !== null) next.prev = sym; else owner.last = sym;
    }

    // Removes the contiguous pair (a, a.next === b) from its owner's body,
    // patching the surrounding links.
    _detachPair(a, b) {
      const owner = a.owner;
      const prev = a.prev;
      const next = b.next;

      this._removeWitnessIfMatches(prev, a);
      this._removeWitnessIfMatches(b, next);

      if (prev !== null) prev.next = next; else owner.first = next;
      if (next !== null) next.prev = prev; else owner.last = prev;

      return { prev: prev, next: next };
    }

    _removeWitnessIfMatches(first, second) {
      if (first === null || second === null) return;
      const key = keyOf(first, second);
      if (this.witness.get(key) === first) this.witness.delete(key);
    }

    _pushBoundaryChecks(prev, sym) {
      if (prev !== null) this.pending.push(prev);
      this.pending.push(sym);
    }

    // Drains the pending worklist, restoring both invariants to a fixed point.
    _enforce(seed) {
      if (seed !== null) this.pending.push(seed);

      while (this.pending.length > 0) {
        const a = this.pending.pop();
        if (a.dead || a.next === null) continue;

        const b = a.next;
        const key = keyOf(a, b);

        const rule = this.ruleByDigram.get(key);
        if (rule !== undefined && !rule.isDeleted) {
          // A digram occurrence that IS a rule's own body definition needs no action.
          if (a === rule.first && b === rule.last) continue;
          this._reuseRule(rule, a, b);
          continue;
        }

        const w = this.witness.get(key);
        if (w !== undefined) {
          if (w === a) continue;

          const wb = w.next;
          if (wb === a) {
            // The two occurrences share their middle symbol (a run of
            // equal-valued symbols such as "aaa"): only one physical pair
            // exists here to promote.
            this._promoteOverlap(key, w, wb, b);
            continue;
          }
          if (b === w) {
            this._promoteOverlap(key, a, w, wb);
            continue;
          }
          if (wb.next === a) {
            // The pairs are distinct but touch with no symbol between them:
            // both anchors must be resolved from a single coordinated splice,
            // or detaching one pair invalidates the other's captured neighbour.
            this._promoteAdjacent(key, w, wb, a, b);
            continue;
          }
          if (b.next === w) {
            this._promoteAdjacent(key, a, b, w, wb);
            continue;
          }

          this._promoteSeparate(key, w, wb, a, b);
          continue;
        }

        this.witness.set(key, a);
      }
    }

    _reuseRule(rule, a, b) {
      const owner = a.owner;
      const ends = this._detachPair(a, b);

      const refSym = new Sym(false, 0, rule);
      Grammar._insertBetween(owner, ends.prev, refSym, ends.next);
      rule.referrers.add(refSym);
      this._pushBoundaryChecks(ends.prev, refSym);

      a.dead = true;
      b.dead = true;
      this._discardIfNonTerminal(a);
      this._discardIfNonTerminal(b);
    }

    // Promotes a repeated digram to a new rule when the witness occurrence
    // (w, wb) and the current occurrence (a, b) are entirely independent sites
    // - no shared symbol and no touching boundary - so each can be detached and
    // patched without disturbing the other's anchors.
    _promoteSeparate(key, w, wb, a, b) {
      const ownerA = a.owner;
      const ownerW = w.owner;

      const endsA = this._detachPair(a, b);
      const endsW = this._detachPair(w, wb);

      const rule = this._newRuleFrom(key, w, wb);

      const refAtW = new Sym(false, 0, rule);
      Grammar._insertBetween(ownerW, endsW.prev, refAtW, endsW.next);
      rule.referrers.add(refAtW);

      const refAtA = new Sym(false, 0, rule);
      Grammar._insertBetween(ownerA, endsA.prev, refAtA, endsA.next);
      rule.referrers.add(refAtA);

      this._pushBoundaryChecks(endsW.prev, refAtW);
      this._pushBoundaryChecks(endsA.prev, refAtA);

      a.dead = true;
      b.dead = true;
      this._discardIfNonTerminal(a);
      this._discardIfNonTerminal(b);
    }

    // Promotes a repeated digram when the witness pair (wLeft, wRight) is
    // immediately followed by the current pair (aLeft, aRight) with no symbol
    // between them. Detaching each pair independently would corrupt the other's
    // captured boundary, so both are removed and replaced by a single
    // coordinated splice instead.
    _promoteAdjacent(key, wLeft, wRight, aLeft, aRight) {
      const owner = wLeft.owner;
      const outerPrev = wLeft.prev;
      const outerNext = aRight.next;

      this._removeWitnessIfMatches(outerPrev, wLeft);
      this._removeWitnessIfMatches(wRight, aLeft);
      this._removeWitnessIfMatches(aRight, outerNext);

      const rule = this._newRuleFrom(key, wLeft, wRight);

      const refW = new Sym(false, 0, rule);
      refW.owner = owner;
      refW.prev = outerPrev;
      const refA = new Sym(false, 0, rule);
      refA.owner = owner;
      refA.next = outerNext;
      refW.next = refA;
      refA.prev = refW;

      if (outerPrev !== null) outerPrev.next = refW; else owner.first = refW;
      if (outerNext !== null) outerNext.prev = refA; else owner.last = refA;

      rule.referrers.add(refW);
      rule.referrers.add(refA);

      if (outerPrev !== null) this.pending.push(outerPrev);
      this.pending.push(refW); // checks (refW, refA)
      this.pending.push(refA); // checks (refA, outerNext)

      aLeft.dead = true;
      aRight.dead = true;
      this._discardIfNonTerminal(aLeft);
      this._discardIfNonTerminal(aRight);
    }

    // Promotes a repeated digram when the witness pair (left, shared) and the
    // current pair (shared, right) overlap at the shared middle symbol (a run
    // of identical symbols such as "aaa"). Only one physical pair exists here
    // to remove; the shared symbol is consumed into the new rule and right
    // simply becomes the following symbol.
    _promoteOverlap(key, left, shared, right) {
      const owner = left.owner;
      const outerPrev = left.prev;

      this._removeWitnessIfMatches(outerPrev, left);

      const rule = this._newRuleFrom(key, left, shared);

      const refSym = new Sym(false, 0, rule);
      refSym.owner = owner;
      refSym.prev = outerPrev;
      refSym.next = right;
      if (outerPrev !== null) outerPrev.next = refSym; else owner.first = refSym;
      right.prev = refSym;

      rule.referrers.add(refSym);

      if (outerPrev !== null) this.pending.push(outerPrev);
      this.pending.push(refSym); // checks (refSym, right)
    }

    _newRuleFrom(key, first, last) {
      const rule = new Rule();
      rule.first = first;
      rule.last = last;
      first.owner = rule;
      first.prev = null;
      last.owner = rule;
      last.next = null;
      this.ruleByDigram.set(key, rule);
      return rule;
    }

    _discardIfNonTerminal(sym) {
      if (sym.isTerminal) return;

      const target = sym.target;
      target.referrers.delete(sym);
      if (!target.isDeleted && target.referrers.size === 1) this._inlineRule(target);
    }

    // Eliminates a rule whose reference count dropped to one, splicing its body
    // into the remaining reference site.
    _inlineRule(rule) {
      rule.isDeleted = true;
      const key = keyOf(rule.first, rule.last);
      this.ruleByDigram.remove(key);

      let onlyRef = null;
      rule.referrers.forEach(function(r) { onlyRef = r; });
      rule.referrers.clear();

      const owner = onlyRef.owner;
      const prev = onlyRef.prev;
      const next = onlyRef.next;

      this._removeWitnessIfMatches(prev, onlyRef);
      this._removeWitnessIfMatches(onlyRef, next);
      onlyRef.dead = true;

      const first = rule.first;
      const last = rule.last;
      // A rule's body can have grown past two symbols via an earlier inlining
      // of its own, so every node in the body - not just the two ends - must be
      // re-owned by the splice target.
      for (let s = first; s !== null; s = s.next) s.owner = owner;
      first.prev = prev;
      last.next = next;

      if (prev !== null) prev.next = first; else owner.first = first;
      if (next !== null) next.prev = last; else owner.last = last;

      if (prev !== null) this.pending.push(prev);
      this.pending.push(first); // re-checks the reconstituted (first, last) digram
      this.pending.push(last);  // checks (last, next)
    }
  }

  // ===== VARINT HELPERS =====

  // Little-endian base-128 varint: 7 payload bits per byte, high bit marks
  // continuation.
  function writeVarUInt(out, value) {
    let v = value;
    while (v >= 0x80) {
      out.push(OpCodes.And32(OpCodes.Or32(v, 0x80), 0xFF));
      v = OpCodes.Shr32(v, 7);
    }
    out.push(OpCodes.And32(v, 0xFF));
  }

  function readVarUInt(data, state) {
    let result = 0;
    let shift = 0;
    let b;
    do {
      if (state.offset >= data.length) throw new Error('Sequitur: truncated varint');
      b = data[state.offset++];
      result = OpCodes.ToUint32(OpCodes.Or32(result, OpCodes.Shl32(OpCodes.And32(b, 0x7F), shift)));
      shift += 7;
    } while (OpCodes.And32(b, 0x80) !== 0);
    return result;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * SequiturCompression - Compression algorithm implementation
   * @class
   * @extends {CompressionAlgorithm}
   */
  class SequiturCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Sequitur";
      this.description = "Online grammar inference by Nevill-Manning and Witten: as each symbol is appended the algorithm enforces digram uniqueness (no adjacent pair occurs twice) and rule utility (every non-start rule is used more than once), producing a straight-line grammar of two-symbol rules in linear time. The grammar's rule bodies and start sequence are serialised as base-128 varints behind a 4-byte little-endian length header.";
      this.inventor = "Craig G. Nevill-Manning, Ian H. Witten";
      this.year = 1997;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.NZ;

      // Documentation and references
      this.documentation = [
        new LinkItem("Nevill-Manning and Witten, Identifying Hierarchical Structure in Sequences (JAIR 7, 1997)", "https://www.jair.org/index.php/jair/article/view/10151"),
        new LinkItem("Wikipedia - Sequitur algorithm", "https://en.wikipedia.org/wiki/Sequitur_algorithm"),
        new LinkItem("Sequitur project page", "http://www.sequitur.info/")
      ];

      this.references = [
        new LinkItem("Nevill-Manning and Witten, Compression and Explanation Using Hierarchical Grammars (The Computer Journal 40, 1997)", "https://academic.oup.com/comjnl/article/40/2_and_3/103/450969"),
        new LinkItem("Wikibooks - Data Compression/Dictionary compression", "https://en.wikibooks.org/wiki/Data_Compression/Dictionary_compression")
      ];

      // Test vectors - byte-exact against CompressionWorkbench's BB_Sequitur
      // building block. Expected outputs are given as hex.
      this.tests = [
        new TestCase(
          [],
          OpCodes.Hex8ToBytes("00000000"),
          "Empty input - only the 4-byte little-endian length header",
          "https://en.wikipedia.org/wiki/Sequitur_algorithm"
        ),
        new TestCase(
          OpCodes.AsciiToBytes("A"),
          OpCodes.Hex8ToBytes("01000000000141"),
          "Single byte 0x41 - no rules, a one-symbol start sequence",
          "https://en.wikipedia.org/wiki/Sequitur_algorithm"
        ),
        new TestCase(
          (function() { const b = new Array(256); for (let i = 0; i < 256; ++i) b[i] = 0x61; return b; })(),
          OpCodes.Hex8ToBytes("00010000070261610280028002028102810202820282020283028302028402840202850285020286028602"),
          "Long repetitive run - 256 copies of 0x61 collapse into a doubling hierarchy",
          "https://en.wikipedia.org/wiki/Sequitur_algorithm"
        ),
        new TestCase(
          (function() { const b = new Array(64); for (let i = 0; i < 64; ++i) b[i] = (i % 2) === 0 ? 0x61 : 0x62; return b; })(),
          OpCodes.Hex8ToBytes("400000000502616202800280020281028102028202820202830283020284028402"),
          "Alternating two-byte pattern - 32 repetitions of 'ab'",
          "https://en.wikipedia.org/wiki/Sequitur_algorithm"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("d3b07a1c8f4e2b6905c1fd3846a70e92"),
          OpCodes.Hex8ToBytes("100000000010d301b0017a1c8f014e2b6905c101fd013846a7010e9201"),
          "Pseudo-random binary sample - 16 high-entropy bytes, no repeated digram",
          "https://en.wikipedia.org/wiki/Sequitur_algorithm"
        ),
        new TestCase(
          OpCodes.AsciiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. "),
          OpCodes.Hex8ToBytes("b4000000710182020474686520019d0204746865201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f7665722001c10201a70204746865200a6c617a7920646f672e200a6c617a7920646f672e200a6c617a7920646f672e200a6c617a7920646f672e200a6c617a7920646f672e200a6c617a7920646f672e200a6c617a7920646f672e2001cb0201c20204746865201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f7665722001e60201cc0204746865200a6c617a7920646f672e200a6c617a7920646f672e200a6c617a7920646f672e200a6c617a7920646f672e200a6c617a7920646f672e200a6c617a7920646f672e200a6c617a7920646f672e2001f00201e70204746865201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f766572201b717569636b2062726f776e20666f78206a756d7073206f76657220047468652004746865200a6c617a7920646f672e200a6c617a7920646f672e200a6c617a7920646f672e200a6c617a7920646f672e200a6c617a7920646f672e200a6c617a7920646f672e200a6c617a7920646f672e200a6c617a7920646f672e201080029c028002a60282029c029d02a602a702c102c202cb02cc02e602e702f002"),
          "ASCII text - 'the quick brown fox jumps over the lazy dog. ' repeated four times",
          "https://en.wikipedia.org/wiki/Sequitur_algorithm"
        ),
        new TestCase(
          (function() { const b = new Array(256); for (let i = 0; i < 256; ++i) b[i] = i; return b; })(),
          OpCodes.Hex8ToBytes("00010000008002000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f80018101820183018401850186018701880189018a018b018c018d018e018f0190019101920193019401950196019701980199019a019b019c019d019e019f01a001a101a201a301a401a501a601a701a801a901aa01ab01ac01ad01ae01af01b001b101b201b301b401b501b601b701b801b901ba01bb01bc01bd01be01bf01c001c101c201c301c401c501c601c701c801c901ca01cb01cc01cd01ce01cf01d001d101d201d301d401d501d601d701d801d901da01db01dc01dd01de01df01e001e101e201e301e401e501e601e701e801e901ea01eb01ec01ed01ee01ef01f001f101f201f301f401f501f601f701f801f901fa01fb01fc01fd01fe01ff01"),
          "All 256 byte values 0x00..0xFF - no repeated digram, so no rule is ever created",
          "https://en.wikipedia.org/wiki/Sequitur_algorithm"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new SequiturInstance(this, isInverse);
    }
  }

  class SequiturInstance extends IAlgorithmInstance {
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
      const input = this.inputBuffer;
      this.inputBuffer = [];
      return this.isInverse ? this._decompress(input) : this._compress(input);
    }

    _compress(data) {
      const out = [
        OpCodes.And32(data.length, 0xFF),
        OpCodes.And32(OpCodes.Shr32(data.length, 8), 0xFF),
        OpCodes.And32(OpCodes.Shr32(data.length, 16), 0xFF),
        OpCodes.And32(OpCodes.Shr32(data.length, 24), 0xFF)
      ];

      if (data.length === 0) return out;

      const grammar = new Grammar();
      for (let i = 0; i < data.length; i++) grammar.appendTerminal(OpCodes.And32(data[i], 0xFF));

      const rendered = grammar.finalize();

      writeVarUInt(out, rendered.rules.length);

      // Rule-utility elimination can splice an inlined rule's body into another
      // rule's body, so a rule is not always exactly two symbols after the
      // grammar settles - each is length-prefixed like the start sequence.
      for (let i = 0; i < rendered.rules.length; i++) SequiturInstance._writeSequence(out, rendered.rules[i]);

      SequiturInstance._writeSequence(out, rendered.startSequence);

      return out;
    }

    static _writeSequence(out, sequence) {
      writeVarUInt(out, sequence.length);
      for (let i = 0; i < sequence.length; i++) writeVarUInt(out, sequence[i]);
    }

    _decompress(data) {
      if (data.length < 4) return [];

      const originalSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      if (originalSize === 0) return [];

      const state = { offset: 4 };
      const ruleCount = readVarUInt(data, state);

      const rules = new Array(ruleCount);
      for (let i = 0; i < ruleCount; ++i) rules[i] = SequiturInstance._readSequence(data, state);

      const startSequence = SequiturInstance._readSequence(data, state);

      const result = new Array(originalSize);
      let resultPos = 0;

      const stack = [];
      for (let i = startSequence.length - 1; i >= 0; --i) stack.push(startSequence[i]);

      while (stack.length > 0) {
        const symbol = stack.pop();
        if (symbol < 256) {
          result[resultPos++] = symbol;
        } else {
          const body = rules[symbol - 256];
          for (let i = body.length - 1; i >= 0; --i) stack.push(body[i]);
        }
      }

      if (resultPos !== originalSize)
        throw new Error('Sequitur: decompressed size mismatch, expected ' + originalSize + ', got ' + resultPos);

      return result;
    }

    static _readSequence(data, state) {
      const length = readVarUInt(data, state);
      const sequence = new Array(length);
      for (let i = 0; i < length; ++i) sequence[i] = readVarUInt(data, state);
      return sequence;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new SequiturCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SequiturCompression, SequiturInstance };
}));
