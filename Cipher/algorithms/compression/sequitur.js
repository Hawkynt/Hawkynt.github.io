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
 * than once anywhere across the grammar - the start sequence and every rule
 * body together. A single grammar-wide index maps each digram to the one
 * occurrence of it that exists. When appending a symbol, or splicing one in
 * while restoring an invariant, produces a second occurrence, the two are
 * merged: if the older occurrence is precisely some rule's entire body, both
 * are replaced by a reference to that rule; otherwise a fresh rule whose body
 * is that digram is created and substituted at both sites. Two occurrences that
 * overlap - sharing a symbol, as the two "aa" digrams in "aaa" do - are not two
 * occurrences and are left alone.
 *
 * Rule utility. Every rule other than the start rule must be referenced more
 * than once. The moment a substitution drops a rule to a single reference, that
 * rule is eliminated: its body is spliced back in place of the lone reference,
 * and the two digrams newly formed at the splice boundaries are themselves
 * checked for uniqueness. This is what stops the grammar filling with rules
 * that cost more to declare than they save.
 *
 * Why it compresses. Enforcing the two invariants to a fixed point makes every
 * repeated phrase collapse into a rule, and repeated sequences of rules
 * collapse in turn, so a sequence built from many copies of one phrase ends up
 * as a shallow hierarchy of rules plus a very short start sequence, whatever
 * the length of the repeated phrase. Input with no repetition at all yields no
 * rules, and the start sequence is then the input itself.
 *
 * Wire format (matches CompressionWorkbench's BB_Sequitur building block):
 *   [originalLength: 4 bytes little-endian]
 *   [ruleCount: varint, little-endian base-128]
 *   [bit stream, most-significant bit first:
 *      for each rule, an Elias gamma code of its body length minus one, so the
 *      usual two-symbol body costs a single bit;
 *      an Elias gamma code of the start sequence length;
 *      every rule body in index order, then the start sequence. A symbol is a
 *      one-bit tag followed by either an eight-bit byte value or a rule index
 *      at the width the rule count needs; a grammar with no rules drops the tag
 *      and stores plain bytes;
 *      zero bits padding to a byte boundary]
 * Rules are numbered by first appearance in a breadth-first walk of the
 * grammar - the start sequence left to right, then the body of rule 0, then
 * rule 1, and so on - so the numbering can be recomputed from the serialised
 * form itself and does not depend on the order in which the rules were built.
 * An empty input produces only the 4-byte header. The grammar is serialised
 * as-is with no follow-on entropy coding, so input with no exploitable
 * repetition ends up somewhat larger than it started: Sequitur still builds
 * rules for digrams that recur by chance, and each one costs more to declare
 * than the two symbols it saves.
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

  // ===== GRAMMAR STRUCTURES =====

  // A single occurrence of a symbol - a terminal byte or a reference to a rule
  // - inside some rule's body, linked to its neighbours.
  class Sym {
    /**
     * @param {boolean} isTerminal - True for a terminal byte
     * @param {int32} terminal - Terminal byte
     * @param {Rule} target - Referenced rule, null for terminals
     * @param {Rule} owner - Rule whose body holds this occurrence
     */
    constructor(isTerminal, terminal, target, owner) {
      /** @type {boolean} */
      this.isTerminal = isTerminal;
      /** @type {int32} */
      this.terminal = terminal;
      /** @type {Rule} */
      this.target = target;
      /** @type {Rule} */
      this.owner = owner;
      /** @type {Sym} */
      this.prev = null;
      /** @type {Sym} */
      this.next = null;
      // Set once this occurrence has been unlinked for good, so a stale
      // reference to it is a detectable no-op rather than a walk into a broken
      // list.
      /** @type {boolean} */
      this.dead = false;
      // Position in the target rule's referrer list, -1 when not listed.
      /** @type {int32} */
      this.refSlot = -1;
    }

    // The value this occurrence contributes to a digram key: a terminal is its
    // byte, a rule reference is 256 plus the rule's serial number.
    /**
     * @returns {int32} Digram key component
     */
    identity() {
      return this.isTerminal ? this.terminal : 256 + this.target.id;
    }
  }

  // A grammar rule. The start rule is unrestricted in length and never
  // eliminated; every other rule is created with a two-symbol body, may grow
  // when another rule is spliced into it, and dies as soon as it is referenced
  // only once.
  class Rule {
    /**
     * @param {int32} id - Serial number
     */
    constructor(id) {
      /** @type {int32} */
      this.id = id;
      /** @type {Sym} */
      this.first = null;
      /** @type {Sym} */
      this.last = null;
      // The occurrences that reference this rule, as an unordered set: each
      // knows its own slot, so removal swaps the last entry into the gap. Only
      // the count is ever consulted, and the sole entry once it drops to one,
      // so the order never matters. A non-start rule with fewer than two is
      // eliminated on sight.
      /** @type {Sym[]} */
      this.referrers = [];
      /** @type {boolean} */
      this.dead = false;
      // Index assigned while rendering, -1 until then.
      /** @type {int32} */
      this.renderIndex = -1;
    }

    /**
     * @param {Sym} sym - New occurrence referencing this rule
     */
    addReferrer(sym) {
      sym.refSlot = this.referrers.length;
      this.referrers.push(sym);
    }

    /**
     * Removes an occurrence; a no-op when it is not listed.
     * @param {Sym} sym - Occurrence to remove
     */
    removeReferrer(sym) {
      /** @type {int32} */
      const slot = sym.refSlot;
      if (slot < 0 || slot >= this.referrers.length || this.referrers[slot] !== sym) {
        return;
      }
      /** @type {Sym} */
      const moved = this.referrers[this.referrers.length - 1];
      this.referrers[slot] = moved;
      moved.refSlot = slot;
      this.referrers.length = this.referrers.length - 1;
      sym.refSlot = -1;
    }
  }

  // Digram index keyed by the (left identity, right identity) pair, one
  // occurrence per key, as chained hash buckets. Only get, set and delete by
  // key are used, so the bucket layout never affects the grammar.
  class DigramIndex {
    constructor() {
      /** @type {int32} */
      this.bits = 10;
      /** @type {int32[]} */
      this.heads = new Int32Array(OpCodes.Shl32(1, this.bits)).fill(-1);
      /** @type {int32[]} */
      this.keyLeft = [];
      /** @type {int32[]} */
      this.keyRight = [];
      /** @type {Sym[]} */
      this.values = [];
      /** @type {int32[]} */
      this.chain = [];
      /** @type {int32} */
      this.freeHead = -1;
      /** @type {int32} */
      this.count = 0;
    }

    /**
     * @param {int32} left - Left identity
     * @param {int32} right - Right identity
     * @returns {int32} Bucket
     */
    _bucket(left, right) {
      /** @type {uint32} */
      const mixed = OpCodes.Mul32(OpCodes.Xor32(OpCodes.Mul32(left, 0x9E3779B1), right), 0x85EBCA6B);
      return OpCodes.Shr32(mixed, 32 - this.bits);
    }

    /**
     * @param {int32} left - Left identity
     * @param {int32} right - Right identity
     * @returns {int32} Entry holding the key, -1 when absent
     */
    _find(left, right) {
      /** @type {int32} */
      let e = this.heads[this._bucket(left, right)];
      while (e >= 0 && (this.keyLeft[e] !== left || this.keyRight[e] !== right)) {
        e = this.chain[e];
      }
      return e;
    }

    /**
     * @param {int32} left - Left identity
     * @param {int32} right - Right identity
     * @returns {Sym} Indexed occurrence, null when none
     */
    get(left, right) {
      /** @type {int32} */
      const e = this._find(left, right);
      if (e < 0) {
        return null;
      }
      return this.values[e];
    }

    /**
     * @param {int32} left - Left identity
     * @param {int32} right - Right identity
     * @param {Sym} sym - Occurrence to index
     */
    set(left, right, sym) {
      /** @type {int32} */
      const found = this._find(left, right);
      if (found >= 0) {
        this.values[found] = sym;
        return;
      }
      if (this.count >= OpCodes.Shl32(1, this.bits)) {
        this._grow();
      }
      /** @type {int32} */
      let e = this.freeHead;
      if (e >= 0) {
        this.freeHead = this.chain[e];
        this.keyLeft[e] = left;
        this.keyRight[e] = right;
        this.values[e] = sym;
      } else {
        e = this.values.length;
        this.keyLeft.push(left);
        this.keyRight.push(right);
        this.values.push(sym);
        this.chain.push(-1);
      }
      /** @type {int32} */
      const bucket = this._bucket(left, right);
      this.chain[e] = this.heads[bucket];
      this.heads[bucket] = e;
      ++this.count;
    }

    /**
     * Drops the key when it currently maps to sym.
     * @param {int32} left - Left identity
     * @param {int32} right - Right identity
     * @param {Sym} sym - Occurrence expected at the key
     */
    removeIf(left, right, sym) {
      /** @type {int32} */
      const bucket = this._bucket(left, right);
      /** @type {int32} */
      let previous = -1;
      /** @type {int32} */
      let e = this.heads[bucket];
      while (e >= 0 && (this.keyLeft[e] !== left || this.keyRight[e] !== right)) {
        previous = e;
        e = this.chain[e];
      }
      if (e < 0 || this.values[e] !== sym) {
        return;
      }
      if (previous < 0) {
        this.heads[bucket] = this.chain[e];
      } else {
        this.chain[previous] = this.chain[e];
      }
      this.values[e] = null;
      this.chain[e] = this.freeHead;
      this.freeHead = e;
      --this.count;
    }

    _grow() {
      ++this.bits;
      this.heads = new Int32Array(OpCodes.Shl32(1, this.bits)).fill(-1);
      /** @type {int32} */
      let free = -1;
      for (let e = this.values.length - 1; e >= 0; --e) {
        if (this.values[e] === null) {
          this.chain[e] = free;
          free = e;
          continue;
        }
        /** @type {int32} */
        const bucket = this._bucket(this.keyLeft[e], this.keyRight[e]);
        this.chain[e] = this.heads[bucket];
        this.heads[bucket] = e;
      }
      this.freeHead = free;
    }
  }

  /**
   * Finished grammar as (rule bodies, start sequence) in the output codebook.
   */
  class RenderedGrammar {
    /**
     * @param {int32[][]} rules - Rule bodies in render order
     * @param {int32[]} startSequence - Start rule body
     */
    constructor(rules, startSequence) {
      /** @type {int32[][]} */
      this.rules = rules;
      /** @type {int32[]} */
      this.startSequence = startSequence;
    }
  }

  // Builds a Sequitur grammar incrementally from appended bytes, restoring
  // digram uniqueness and rule utility to a fixed point after every append.
  class Grammar {
    constructor() {
      /** @type {Rule[]} */
      this.rules = [];
      /** @type {int32} */
      this.nextRuleId = 0;
      // Digram index: (left identity, right identity) -> the one occurrence.
      /** @type {DigramIndex} */
      this.digrams = new DigramIndex();
      /** @type {Rule[]} */
      this.underused = [];
      /** @type {Rule} */
      this.start = this._newRule();
    }

    // Appends one input byte to the start rule and restores both invariants.
    /**
     * @param {int32} value - Input byte
     */
    append(value) {
      /** @type {Sym} */
      const sym = new Sym(true, value, null, this.start);
      sym.prev = this.start.last;
      if (this.start.last !== null) {
        this.start.last.next = sym;
      } else {
        this.start.first = sym;
      }
      this.start.last = sym;
      this._check(sym.prev);
    }

    // Numbers the surviving rules by first appearance in a breadth-first walk
    // of the finished grammar and renders it as (rule bodies, start sequence)
    // using the codebook terminal = 0..255, non-terminal = 256 + rule index.
    //
    // The walk reads the start sequence left to right, giving the next free
    // index to each rule reference it has not seen before, then does the same
    // over the body of rule 0, then rule 1, and so on until no rule is left
    // unnumbered. The numbering is therefore a property of the grammar that is
    // being written out - it can be recomputed from the serialised form alone
    // - and owes nothing to the order in which the rules happened to be
    // created, how many died on the way, or how any collection enumerates.
    /**
     * @returns {RenderedGrammar} Serialisable grammar
     */
    render() {
      /** @type {Rule[]} */
      const live = [];

      Grammar._numberBody(this.start.first, live);
      /** @type {int32} */
      let walked = Grammar._drain(live, 0);

      // Every live rule of a well-formed Sequitur grammar is reachable from the
      // start sequence, so this tail never runs. It is here so that an
      // unreachable rule would still get a defined index - creation order,
      // after everything reachable - instead of being dropped and leaving the
      // bodies that mention it dangling.
      for (let i = 0; i < this.rules.length; ++i) {
        /** @type {Rule} */
        const rule = this.rules[i];
        if (rule.dead || rule === this.start || rule.renderIndex >= 0) {
          continue;
        }
        Grammar._number(rule, live);
        walked = Grammar._drain(live, walked);
      }

      /** @type {int32[][]} */
      const rules = [];
      for (let i = 0; i < live.length; ++i) {
        /** @type {int32[]} */
        const body = [];
        for (let s = live[i].first; s !== null; s = s.next) {
          /** @type {int32} */
          const code = Grammar._code(s);
          body.push(code);
        }
        rules.push(body);
      }

      /** @type {int32[]} */
      const startSequence = [];
      for (let s = this.start.first; s !== null; s = s.next) {
        /** @type {int32} */
        const code = Grammar._code(s);
        startSequence.push(code);
      }

      return new RenderedGrammar(rules, startSequence);
    }

    /**
     * Gives the rule the next free index unless it already has one.
     * @param {Rule} rule - Rule to number
     * @param {Rule[]} live - Numbered rules in index order
     */
    static _number(rule, live) {
      if (rule.renderIndex >= 0) {
        return;
      }
      rule.renderIndex = live.length;
      live.push(rule);
    }

    /**
     * @param {Sym} first - First symbol of a body
     * @param {Rule[]} live - Numbered rules in index order
     */
    static _numberBody(first, live) {
      for (let s = first; s !== null; s = s.next) {
        if (!s.isTerminal) {
          Grammar._number(s.target, live);
        }
      }
    }

    // Numbers every rule referenced by a body that has itself just been
    // numbered, until the frontier is empty.
    /**
     * @param {Rule[]} live - Numbered rules in index order
     * @param {int32} walked - Rules whose bodies were already walked
     * @returns {int32} Rules walked afterwards (all of live)
     */
    static _drain(live, walked) {
      /** @type {int32} */
      let next = walked;
      for (; next < live.length; ++next) {
        Grammar._numberBody(live[next].first, live);
      }
      return next;
    }

    /**
     * @param {Sym} sym - Occurrence
     * @returns {int32} Its code: the byte, or 256 plus the rule's index
     */
    static _code(sym) {
      return sym.isTerminal ? sym.terminal : 256 + sym.target.renderIndex;
    }

    /**
     * @returns {Rule} New rule
     */
    _newRule() {
      /** @type {Rule} */
      const rule = new Rule(this.nextRuleId++);
      this.rules.push(rule);
      return rule;
    }

    // Drops the index entry for the digram (left, right) when that pair is the
    // occurrence currently indexed.
    /**
     * @param {Sym} left - First symbol of the digram, may be null
     * @param {Sym} right - Second symbol of the digram, may be null
     */
    _removeDigram(left, right) {
      if (left === null || right === null) {
        return;
      }
      /** @type {int32} */
      const leftId = left.identity();
      /** @type {int32} */
      const rightId = right.identity();
      this.digrams.removeIf(leftId, rightId, left);
    }

    // Examines the digram starting at `left`. Registers it when it is the only
    // occurrence, and merges it with the existing one otherwise. Returns whether
    // a substitution took place, because that means `left` and its successor no
    // longer exist.
    /**
     * @param {Sym} left - First symbol of the digram, may be null
     * @returns {boolean} True when a substitution took place
     */
    _check(left) {
      if (left === null || left.dead || left.next === null) {
        return false;
      }

      /** @type {int32} */
      const leftId = left.identity();
      /** @type {Sym} */
      const right = left.next;
      /** @type {int32} */
      const rightId = right.identity();
      /** @type {Sym} */
      const found = this.digrams.get(leftId, rightId);
      if (found === null || found.dead || found.next === null) {
        this.digrams.set(leftId, rightId, left);
        return false;
      }

      // Occurrences that share a symbol are one occurrence of the digram, not two.
      if (found === left || found.next === left || left.next === found) {
        return false;
      }

      this._merge(left, found);
      return true;
    }

    // Merges a newly created occurrence of a digram with the older one, either
    // by reusing the rule the older occurrence already constitutes or by
    // promoting the digram to a new rule and substituting it at both sites.
    /**
     * @param {Sym} newOccurrence - Newer occurrence
     * @param {Sym} oldOccurrence - Indexed occurrence
     */
    _merge(newOccurrence, oldOccurrence) {
      /** @type {Rule} */
      let rule = null;
      if (oldOccurrence.owner !== this.start && oldOccurrence.prev === null && oldOccurrence.next.next === null) {
        // The older occurrence is exactly some rule's whole body: reuse it.
        rule = oldOccurrence.owner;
      } else {
        rule = this._newRule();
        // Copy first, then substitute, so a rule referenced by the digram never
        // dips below two references in between and get eliminated spuriously.
        /** @type {Sym} */
        const first = Grammar._copy(oldOccurrence, rule);
        /** @type {Sym} */
        const second = Grammar._copy(oldOccurrence.next, rule);
        first.next = second;
        second.prev = first;
        rule.first = first;
        rule.last = second;
        // The rule body is now the canonical occurrence of this digram, so the
        // substitution below must not take the index entry away with it.
        /** @type {int32} */
        const firstId = first.identity();
        /** @type {int32} */
        const secondId = second.identity();
        this.digrams.set(firstId, secondId, first);
        this._substitute(oldOccurrence, rule);
      }

      // Restoring the invariants at the older site can cascade anywhere in the
      // grammar, including over the newer site, so the newer occurrence is
      // re-validated rather than trusted.
      if (!rule.dead) {
        /** @type {boolean} */
        const still = Grammar._stillOccurs(newOccurrence, rule);
        if (still) {
          this._substitute(newOccurrence, rule);
        }
      }

      // A rule that ends up referenced once has to give its body back.
      if (!rule.dead && rule.referrers.length < 2) {
        this.underused.push(rule);
        this._eliminateUnderused();
      }
    }

    /**
     * @param {Sym} left - Candidate first symbol
     * @param {Rule} rule - Two-symbol rule
     * @returns {boolean} True when left and its successor still spell the rule's body
     */
    static _stillOccurs(left, rule) {
      if (left.dead || left.next === null) {
        return false;
      }
      /** @type {int32} */
      const leftId = left.identity();
      /** @type {int32} */
      const firstId = rule.first.identity();
      if (leftId !== firstId) {
        return false;
      }
      /** @type {Sym} */
      const right = left.next;
      /** @type {int32} */
      const rightId = right.identity();
      /** @type {int32} */
      const lastId = rule.last.identity();
      return rightId === lastId && rule.last === rule.first.next;
    }

    /**
     * @param {Sym} source - Occurrence to copy
     * @param {Rule} owner - Rule the copy belongs to
     * @returns {Sym} Copy, registered with its target rule
     */
    static _copy(source, owner) {
      /** @type {Sym} */
      const copy = new Sym(source.isTerminal, source.terminal, source.target, owner);
      if (copy.target !== null) {
        copy.target.addReferrer(copy);
      }
      return copy;
    }

    // Replaces the two symbols starting at `left` with a single reference to
    // `rule`, then restores both invariants around the splice.
    /**
     * @param {Sym} left - First symbol of the digram
     * @param {Rule} rule - Rule to reference
     */
    _substitute(left, rule) {
      /** @type {Sym} */
      const right = left.next;
      /** @type {Rule} */
      const owner = left.owner;
      /** @type {Sym} */
      const before = left.prev;
      /** @type {Sym} */
      const after = right.next;
      /** @type {Sym} */
      const beforePrev = before === null ? null : before.prev;

      this._removeDigram(before, left);
      this._removeDigram(left, right);
      this._removeDigram(right, after);

      /** @type {Sym} */
      const reference = new Sym(false, 0, rule, owner);
      reference.prev = before;
      reference.next = after;
      if (before !== null) {
        before.next = reference;
      } else {
        owner.first = reference;
      }
      if (after !== null) {
        after.prev = reference;
      } else {
        owner.last = reference;
      }
      rule.addReferrer(reference);

      this._release(left);
      this._release(right);
      this._eliminateUnderused();

      // Both new boundaries need examining. Should the first substitute, the
      // reference is gone and the second call sees a retired symbol and stops.
      this._check(before);
      this._check(reference);
      this._releaseOverlapSuppression(beforePrev, after);
    }

    // Re-examines the two digrams that flanked the pair just removed. Either may
    // have been left unregistered because it overlapped a digram that has now
    // gone from the index, which would make it the only occurrence of itself
    // while nothing in the index says so.
    /**
     * @param {Sym} beforePrev - Symbol two before the removed pair, may be null
     * @param {Sym} after - Symbol after the removed pair, may be null
     */
    _releaseOverlapSuppression(beforePrev, after) {
      this._check(beforePrev);
      this._check(after);
    }

    // Retires an occurrence and, when it was a rule reference, notes any rule
    // that has just become underused.
    /**
     * @param {Sym} sym - Occurrence to retire
     */
    _release(sym) {
      sym.dead = true;
      sym.prev = null;
      sym.next = null;
      if (sym.isTerminal) {
        return;
      }

      /** @type {Rule} */
      const target = sym.target;
      target.removeReferrer(sym);
      if (!target.dead && target.referrers.length === 1) {
        this.underused.push(target);
      }
    }

    // Splices the body of every rule that is down to one reference back into
    // that reference's place.
    _eliminateUnderused() {
      while (this.underused.length > 0) {
        /** @type {Rule} */
        const rule = this.underused.shift();
        if (rule.dead) {
          continue;
        }
        if (rule.referrers.length === 0) {
          // Nothing refers to it any more, so there is nothing to splice back.
          rule.dead = true;
          continue;
        }

        if (rule.referrers.length !== 1) {
          continue;
        }

        this._expand(rule, rule.referrers[0]);
      }
    }

    // Replaces the lone reference to `rule` by the rule's own body and retires
    // the rule.
    /**
     * @param {Rule} rule - Rule referenced once
     * @param {Sym} reference - Its only reference
     */
    _expand(rule, reference) {
      /** @type {Rule} */
      const owner = reference.owner;
      /** @type {Sym} */
      const before = reference.prev;
      /** @type {Sym} */
      const after = reference.next;
      /** @type {Sym} */
      const beforePrev = before === null ? null : before.prev;

      this._removeDigram(before, reference);
      this._removeDigram(reference, after);

      /** @type {Sym} */
      const first = rule.first;
      /** @type {Sym} */
      const last = rule.last;
      for (let s = first; s !== null; s = s.next) {
        s.owner = owner;
      }

      first.prev = before;
      last.next = after;
      if (before !== null) {
        before.next = first;
      } else {
        owner.first = first;
      }
      if (after !== null) {
        after.prev = last;
      } else {
        owner.last = last;
      }

      rule.removeReferrer(reference);
      rule.dead = true;
      rule.first = null;
      rule.last = null;
      reference.dead = true;
      reference.prev = null;
      reference.next = null;

      // Only the two boundaries changed; the digrams inside the body are
      // untouched and stay in the index exactly as they were. The two are far
      // enough apart that both need examining, and a retired symbol stops the
      // second call by itself.
      this._check(before);
      this._check(last);
      this._releaseOverlapSuppression(beforePrev, after);
    }
  }

  // ===== SERIALISATION HELPERS =====

  /**
   * Read position of the varint parser.
   */
  class ReadState {
    /**
     * @param {int32} offset - Initial byte position
     */
    constructor(offset) {
      /** @type {int32} */
      this.offset = offset;
    }
  }

  // Little-endian base-128 varint: 7 payload bits per byte, high bit marks
  // continuation.
  /**
   * @param {uint8[]} out - Output, appended to
   * @param {int32} value - Non-negative value
   */
  function writeVarUInt(out, value) {
    /** @type {int32} */
    let v = value;
    while (v >= 0x80) {
      out.push(OpCodes.And32(OpCodes.Or32(v, 0x80), 0xFF));
      v = Math.floor(v / 128);
    }
    out.push(OpCodes.And32(v, 0xFF));
  }

  /**
   * @param {uint8[]} data - Input
   * @param {ReadState} state - Read position, advanced
   * @returns {float64} Decoded value
   */
  function readVarUInt(data, state) {
    /** @type {float64} */
    let result = 0;
    /** @type {float64} */
    let scale = 1;
    /** @type {uint8} */
    let b = 0;
    do {
      if (state.offset >= data.length) {
        throw new Error('Sequitur: truncated varint');
      }
      b = data[state.offset++];
      /** @type {float64} */
      const payload = OpCodes.And32(b, 0x7F);
      result += payload * scale;
      scale *= 128;
    } while (b >= 0x80);
    return result;
  }

  // Packs fixed-width codes most-significant-bit first onto the end of a byte
  // array.
  class BitWriter {
    /**
     * @param {uint8[]} output - Output, appended to
     */
    constructor(output) {
      /** @type {uint8[]} */
      this.output = output;
      /** @type {int32} */
      this.buffer = 0;
      /** @type {int32} */
      this.count = 0;
    }

    /**
     * @param {uint32} value - Value whose low bits are written
     * @param {int32} bits - Bit count, most significant first
     */
    write(value, bits) {
      for (let b = bits - 1; b >= 0; --b) {
        this.buffer = this.buffer * 2 + OpCodes.And32(OpCodes.Shr32(value, b), 1);
        if (++this.count !== 8) {
          continue;
        }
        this.output.push(this.buffer);
        this.buffer = 0;
        this.count = 0;
      }
    }

    // Writes a positive value as an Elias gamma code: its bit length minus one
    // in unary zeros, then the value itself. A rule body of the usual two
    // symbols therefore costs a single bit.
    /**
     * @param {int32} value - Positive value
     */
    writeGamma(value) {
      /** @type {int32} */
      let bits = 1;
      while (Math.pow(2, bits) <= value) {
        ++bits;
      }
      this.write(0, bits - 1);
      this.write(value, bits);
    }

    flush() {
      while (this.count !== 0) {
        this.write(0, 1);
      }
    }
  }

  // Reads the fixed-width codes written by BitWriter.
  class BitReader {
    /**
     * @param {uint8[]} data - Input
     * @param {int32} offset - First byte of the bit stream
     */
    constructor(data, offset) {
      /** @type {uint8[]} */
      this.data = data;
      /** @type {int32} */
      this.position = offset;
      /** @type {uint8} */
      this.buffer = 0;
      /** @type {int32} */
      this.count = 0;
    }

    /**
     * @param {int32} bits - Bit count, most significant first
     * @returns {float64} Value read
     */
    read(bits) {
      /** @type {float64} */
      let value = 0;
      for (let i = 0; i < bits; ++i) {
        if (this.count === 0) {
          if (this.position >= this.data.length) {
            throw new Error('Sequitur: truncated symbol stream');
          }
          this.buffer = this.data[this.position++];
          this.count = 8;
        }
        --this.count;
        /** @type {float64} */
        const bit = OpCodes.And32(OpCodes.Shr32(this.buffer, this.count), 1);
        value = value * 2 + bit;
      }
      return value;
    }

    /**
     * @returns {float64} Elias gamma value
     */
    readGamma() {
      /** @type {int32} */
      let leadingZeros = 0;
      for (;;) {
        /** @type {float64} */
        const bit = this.read(1);
        if (bit !== 0) {
          break;
        }
        if (++leadingZeros > 31) {
          throw new Error('Sequitur: malformed length code');
        }
      }

      /** @type {float64} */
      let value = 1;
      for (let i = 0; i < leadingZeros; ++i) {
        /** @type {float64} */
        const bit = this.read(1);
        value = value * 2 + bit;
      }
      return value;
    }
  }

  // The code width, in bits, that holds any rule index of a grammar with
  // ruleCount rules.
  /**
   * @param {float64} ruleCount - Number of rules
   * @returns {int32} Index width in bits (at least 1)
   */
  function ruleBitsFor(ruleCount) {
    /** @type {int32} */
    let bits = 1;
    while (Math.pow(2, bits) < ruleCount) {
      ++bits;
    }
    return bits;
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
      this.description = "Online grammar inference by Nevill-Manning and Witten: as each symbol is appended the algorithm enforces digram uniqueness (no adjacent pair occurs twice anywhere in the grammar) and rule utility (every non-start rule is referenced more than once), producing a straight-line grammar in linear time. Repeated phrases collapse into rules and repeated sequences of rules collapse in turn, so heavily repetitive input ends up as a handful of rules plus a very short start sequence. The grammar is bit-packed with no follow-on entropy coding.";
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
      //
      // The first three were derived by hand: the empty case is the length
      // header alone; "A" has no repeated digram, so the grammar is one
      // terminal and the bit stream is gamma(1) followed by 0x41; and "aaaa"
      // settles to R0 -> 'a' 'a' with the start sequence R0 R0, which lays out
      // as gamma(1) gamma(2) then two tagged terminals and two tagged rule
      // references. The rest were checked by parsing the serialised grammar
      // back out and confirming, without reference to the encoder, that it
      // expands to the input, that no digram occurs twice non-overlappingly,
      // that every rule is referenced more than once, and that re-serialising
      // the parsed grammar reproduces these exact bytes.
      this.tests = [
        new TestCase(
          [],
          OpCodes.Hex8ToBytes("00000000"),
          "Empty input - only the 4-byte little-endian length header",
          "https://www.jair.org/index.php/jair/article/view/10151"
        ),
        new TestCase(
          OpCodes.AsciiToBytes("A"),
          OpCodes.Hex8ToBytes("0100000000a080"),
          "Single byte 0x41 - no rules, a one-symbol start sequence stored as a plain byte",
          "https://www.jair.org/index.php/jair/article/view/10151"
        ),
        new TestCase(
          (function() { const b = new Array(4); for (let i = 0; i < 4; ++i) b[i] = 0x61; return b; })(),
          OpCodes.Hex8ToBytes("0400000001a3098680"),
          "Four identical bytes - the digram 'aa' becomes rule 0 and the start sequence is that rule twice",
          "https://en.wikipedia.org/wiki/Sequitur_algorithm"
        ),
        new TestCase(
          (function() { const b = new Array(256); for (let i = 0; i < 256; ++i) b[i] = 0x61; return b; })(),
          OpCodes.Hex8ToBytes("0001000007fea66aaef3377b8c261880"),
          "Long repetitive run - 256 copies of 0x61 collapse into a doubling hierarchy of 7 rules",
          "https://en.wikipedia.org/wiki/Sequitur_algorithm"
        ),
        new TestCase(
          (function() { const b = new Array(64); for (let i = 0; i < 64; ++i) b[i] = (i % 2) === 0 ? 0x61 : 0x62; return b; })(),
          OpCodes.Hex8ToBytes("4000000005fa99aabbcc3098a200"),
          "Alternating two-byte pattern - 32 repetitions of 'ab' collapse into 5 rules",
          "https://en.wikipedia.org/wiki/Sequitur_algorithm"
        ),
        new TestCase(
          OpCodes.AsciiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. "),
          OpCodes.Hex8ToBytes("b400000004704731d0d065106e713a9a4c66b10188e46f3b9b84066379e0406a3a9b4e073101bcec6539736184f47910190de67170824b6e1000"),
          "ASCII text - 'the quick brown fox jumps over the lazy dog. ' repeated four times folds into 4 rules",
          "https://www.jair.org/index.php/jair/article/view/10151"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("d3b07a1c8f4e2b6905c1fd3846a70e92"),
          OpCodes.Hex8ToBytes("10000000000869d83d0e47a715b482e0fe9c2353874900"),
          "Pseudo-random binary sample - no repeated digram, so no rule is ever created",
          "https://en.wikipedia.org/wiki/Sequitur_algorithm"
        ),
        new TestCase(
          (function() { const b = new Array(256); for (let i = 0; i < 256; ++i) b[i] = i; return b; })(),
          OpCodes.Hex8ToBytes("0001000000008000008101820283038404850586068707880889098a0a8b0b8c0c8d0d8e0e8f0f90109111921293139414951596169717981899199a1a9b1b9c1c9d1d9e1e9f1fa020a121a222a323a424a525a626a727a828a929aa2aab2bac2cad2dae2eaf2fb030b131b232b333b434b535b636b737b838b939ba3abb3bbc3cbd3dbe3ebf3fc040c141c242c343c444c545c646c747c848c949ca4acb4bcc4ccd4dce4ecf4fd050d151d252d353d454d555d656d757d858d959da5adb5bdc5cdd5dde5edf5fe060e161e262e363e464e565e666e767e868e969ea6aeb6bec6ced6dee6eef6ff070f171f272f373f474f575f676f777f878f979fa7afb7bfc7cfd7dfe7eff7f80"),
          "All 256 byte values 0x00..0xFF - no repeated digram, so the start sequence is the input itself",
          "https://en.wikipedia.org/wiki/Sequitur_algorithm"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new SequiturInstance(this, isInverse);
    }
  }

  class SequiturInstance extends IAlgorithmInstance {
    /**
     * @param {SequiturCompression} algorithm - Owning algorithm
     * @param {boolean} isInverse - True for decompression
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
    }


    /**
     * @returns {uint8[]} Compressed or decompressed bytes
     */
    Result() {
      /** @type {uint8[]} */
      const input = this.inputBuffer;
      this.inputBuffer = [];
      if (this.isInverse) {
        return this._decompress(input);
      }
      return this._compress(input);
    }

    /**
     * @param {uint8[]} data - Input
     * @returns {uint8[]} Size header, rule count and the bit-packed grammar
     */
    _compress(data) {
      /** @type {uint8[]} */
      const lengthBytes = OpCodes.Unpack32LE(OpCodes.ToUint32(data.length));
      /** @type {uint8[]} */
      const out = [];
      for (let i = 0; i < 4; ++i) {
        out.push(lengthBytes[i]);
      }
      if (data.length === 0) {
        return out;
      }

      /** @type {Grammar} */
      const grammar = new Grammar();
      for (let i = 0; i < data.length; i++) {
        grammar.append(OpCodes.And32(data[i], 0xFF));
      }

      /** @type {RenderedGrammar} */
      const rendered = grammar.render();
      /** @type {int32[][]} */
      const rules = rendered.rules;
      /** @type {int32[]} */
      const startSequence = rendered.startSequence;

      writeVarUInt(out, rules.length);

      /** @type {int32} */
      const ruleBits = ruleBitsFor(rules.length);
      /** @type {BitWriter} */
      const writer = new BitWriter(out);
      for (let i = 0; i < rules.length; ++i) {
        writer.writeGamma(rules[i].length - 1);
      }
      writer.writeGamma(startSequence.length);

      for (let i = 0; i < rules.length; ++i) {
        /** @type {int32[]} */
        const body = rules[i];
        for (let k = 0; k < body.length; ++k) {
          SequiturInstance._writeSymbol(writer, body[k], rules.length, ruleBits);
        }
      }
      for (let k = 0; k < startSequence.length; ++k) {
        SequiturInstance._writeSymbol(writer, startSequence[k], rules.length, ruleBits);
      }
      writer.flush();

      return out;
    }

    /**
     * @param {BitWriter} writer - Output bits
     * @param {int32} symbol - Terminal byte or 256 + rule index
     * @param {int32} ruleCount - Number of rules
     * @param {int32} ruleBits - Rule index width
     */
    static _writeSymbol(writer, symbol, ruleCount, ruleBits) {
      if (ruleCount === 0) {
        writer.write(symbol, 8);
        return;
      }

      if (symbol < 256) {
        writer.write(0, 1);
        writer.write(symbol, 8);
      } else {
        writer.write(1, 1);
        writer.write(symbol - 256, ruleBits);
      }
    }

    /**
     * @param {BitReader} reader - Input bits
     * @param {float64} ruleCount - Number of rules
     * @param {int32} ruleBits - Rule index width
     * @returns {float64} Terminal byte or 256 + rule index
     */
    static _readSymbol(reader, ruleCount, ruleBits) {
      if (ruleCount === 0) {
        /** @type {float64} */
        const plain = reader.read(8);
        return plain;
      }
      /** @type {float64} */
      const flag = reader.read(1);
      if (flag === 0) {
        /** @type {float64} */
        const terminal = reader.read(8);
        return terminal;
      }
      /** @type {float64} */
      const ruleIndex = reader.read(ruleBits);
      return 256 + ruleIndex;
    }

    /**
     * @param {uint8[]} data - Size header, rule count and the bit-packed grammar
     * @returns {uint8[]} Decompressed bytes
     */
    _decompress(data) {
      if (data.length === 0) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }
      if (data.length < 4) {
        throw new Error('Sequitur: truncated header');
      }

      /** @type {uint32} */
      const originalSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      if (originalSize === 0) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      /** @type {ReadState} */
      const state = new ReadState(4);
      /** @type {float64} */
      const ruleCount = readVarUInt(data, state);

      /** @type {int32} */
      const ruleBits = ruleBitsFor(ruleCount);
      /** @type {BitReader} */
      const reader = new BitReader(data, state.offset);

      /** @type {float64[]} */
      const lengths = new Array(ruleCount + 1);
      for (let i = 0; i < ruleCount; ++i) {
        /** @type {float64} */
        const gamma = reader.readGamma();
        lengths[i] = gamma + 1;
      }
      /** @type {float64} */
      const startLength = reader.readGamma();
      lengths[ruleCount] = startLength;

      /** @type {float64[][]} */
      const rules = new Array(ruleCount);
      for (let i = 0; i < ruleCount; ++i) {
        /** @type {float64[]} */
        const body = new Array(lengths[i]);
        for (let k = 0; k < body.length; ++k) {
          /** @type {float64} */
          const symbol = SequiturInstance._readSymbol(reader, ruleCount, ruleBits);
          body[k] = symbol;
        }
        rules[i] = body;
      }

      /** @type {float64[]} */
      const startSequence = new Array(lengths[ruleCount]);
      for (let k = 0; k < startSequence.length; ++k) {
        /** @type {float64} */
        const symbol = SequiturInstance._readSymbol(reader, ruleCount, ruleBits);
        startSequence[k] = symbol;
      }

      /** @type {uint8[]} */
      const result = new Array(originalSize);
      /** @type {int32} */
      let resultPos = 0;

      /** @type {float64[]} */
      const stack = [];
      for (let i = startSequence.length - 1; i >= 0; --i) {
        stack.push(startSequence[i]);
      }

      while (stack.length > 0) {
        /** @type {float64} */
        const symbol = stack.pop();
        if (symbol < 256) {
          if (resultPos >= originalSize) {
            throw new Error('Sequitur: grammar expands past the declared length');
          }
          result[resultPos++] = symbol;
          continue;
        }

        /** @type {float64} */
        const index = symbol - 256;
        if (index >= ruleCount) {
          throw new Error('Sequitur: reference to a rule that does not exist');
        }
        /** @type {float64[]} */
        const body = rules[index];
        for (let i = body.length - 1; i >= 0; --i) {
          stack.push(body[i]);
        }
      }

      if (resultPos !== originalSize) {
        throw new Error('Sequitur: decompressed size mismatch, expected ' + originalSize + ', got ' + resultPos);
      }

      return result;
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
