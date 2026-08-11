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
    constructor(isTerminal, terminal, target, owner) {
      this.isTerminal = isTerminal;
      this.terminal = terminal;
      this.target = target;
      this.owner = owner;
      this.prev = null;
      this.next = null;
      // Set once this occurrence has been unlinked for good, so a stale
      // reference to it is a detectable no-op rather than a walk into a broken
      // list.
      this.dead = false;
    }

    // The value this occurrence contributes to a digram key: a terminal is its
    // byte, a rule reference is 256 plus the rule's serial number.
    identity() {
      return this.isTerminal ? this.terminal : 256 + this.target.id;
    }
  }

  // A grammar rule. The start rule is unrestricted in length and never
  // eliminated; every other rule is created with a two-symbol body, may grow
  // when another rule is spliced into it, and dies as soon as it is referenced
  // only once.
  class Rule {
    constructor(id) {
      this.id = id;
      this.first = null;
      this.last = null;
      // The occurrences that reference this rule. A non-start rule with fewer
      // than two is eliminated on sight.
      this.referrers = new Set();
      this.dead = false;
    }
  }

  // Builds a Sequitur grammar incrementally from appended bytes, restoring
  // digram uniqueness and rule utility to a fixed point after every append.
  class Grammar {
    constructor() {
      this.rules = [];
      this.nextRuleId = 0;
      // Digram index: left identity -> right identity -> the one occurrence.
      this.digrams = new Map();
      this.underused = [];
      this.start = this._newRule();
    }

    // Appends one input byte to the start rule and restores both invariants.
    append(value) {
      const sym = new Sym(true, value, null, this.start);
      sym.prev = this.start.last;
      if (this.start.last !== null) this.start.last.next = sym; else this.start.first = sym;
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
    render() {
      const live = [];
      const index = new Map();
      let walked = 0;

      const number = function(rule) {
        if (index.has(rule)) return;
        index.set(rule, live.length);
        live.push(rule);
      };

      const numberBody = function(first) {
        for (let s = first; s !== null; s = s.next)
          if (!s.isTerminal) number(s.target);
      };

      // Numbers every rule referenced by a body that has itself just been
      // numbered, until the frontier is empty.
      const drain = function() {
        for (; walked < live.length; ++walked) numberBody(live[walked].first);
      };

      numberBody(this.start.first);
      drain();

      // Every live rule of a well-formed Sequitur grammar is reachable from the
      // start sequence, so this tail never runs. It is here so that an
      // unreachable rule would still get a defined index - creation order,
      // after everything reachable - instead of being dropped and leaving the
      // bodies that mention it dangling.
      for (let i = 0; i < this.rules.length; ++i) {
        const rule = this.rules[i];
        if (rule.dead || rule === this.start || index.has(rule)) continue;
        number(rule);
        drain();
      }

      const code = function(sym) {
        return sym.isTerminal ? sym.terminal : 256 + index.get(sym.target);
      };

      const rules = [];
      for (let i = 0; i < live.length; ++i) {
        const body = [];
        for (let s = live[i].first; s !== null; s = s.next) body.push(code(s));
        rules.push(body);
      }

      const startSequence = [];
      for (let s = this.start.first; s !== null; s = s.next) startSequence.push(code(s));

      return { rules: rules, startSequence: startSequence };
    }

    _newRule() {
      const rule = new Rule(this.nextRuleId++);
      this.rules.push(rule);
      return rule;
    }

    _digramGet(left, right) {
      const row = this.digrams.get(left);
      if (row === undefined) return undefined;
      return row.get(right);
    }

    _digramSet(left, right, sym) {
      let row = this.digrams.get(left);
      if (row === undefined) {
        row = new Map();
        this.digrams.set(left, row);
      }
      row.set(right, sym);
    }

    // Drops the index entry for the digram (left, right) when that pair is the
    // occurrence currently indexed.
    _removeDigram(left, right) {
      if (left === null || right === null) return;
      const row = this.digrams.get(left.identity());
      if (row === undefined) return;
      const key = right.identity();
      if (row.get(key) === left) row.delete(key);
    }

    // Examines the digram starting at `left`. Registers it when it is the only
    // occurrence, and merges it with the existing one otherwise. Returns whether
    // a substitution took place, because that means `left` and its successor no
    // longer exist.
    _check(left) {
      if (left === null || left.dead || left.next === null) return false;

      const leftId = left.identity();
      const rightId = left.next.identity();
      const found = this._digramGet(leftId, rightId);
      if (found === undefined || found.dead || found.next === null) {
        this._digramSet(leftId, rightId, left);
        return false;
      }

      // Occurrences that share a symbol are one occurrence of the digram, not two.
      if (found === left || found.next === left || left.next === found) return false;

      this._merge(left, found);
      return true;
    }

    // Merges a newly created occurrence of a digram with the older one, either
    // by reusing the rule the older occurrence already constitutes or by
    // promoting the digram to a new rule and substituting it at both sites.
    _merge(newOccurrence, oldOccurrence) {
      let rule;
      if (oldOccurrence.owner !== this.start && oldOccurrence.prev === null && oldOccurrence.next.next === null) {
        // The older occurrence is exactly some rule's whole body: reuse it.
        rule = oldOccurrence.owner;
      } else {
        rule = this._newRule();
        // Copy first, then substitute, so a rule referenced by the digram never
        // dips below two references in between and get eliminated spuriously.
        const first = Grammar._copy(oldOccurrence, rule);
        const second = Grammar._copy(oldOccurrence.next, rule);
        first.next = second;
        second.prev = first;
        rule.first = first;
        rule.last = second;
        // The rule body is now the canonical occurrence of this digram, so the
        // substitution below must not take the index entry away with it.
        this._digramSet(first.identity(), second.identity(), first);
        this._substitute(oldOccurrence, rule);
      }

      // Restoring the invariants at the older site can cascade anywhere in the
      // grammar, including over the newer site, so the newer occurrence is
      // re-validated rather than trusted.
      if (!rule.dead && Grammar._stillOccurs(newOccurrence, rule))
        this._substitute(newOccurrence, rule);

      // A rule that ends up referenced once has to give its body back.
      if (!rule.dead && rule.referrers.size < 2) {
        this.underused.push(rule);
        this._eliminateUnderused();
      }
    }

    static _stillOccurs(left, rule) {
      return !left.dead
        && left.next !== null
        && left.identity() === rule.first.identity()
        && left.next.identity() === rule.last.identity()
        && rule.last === rule.first.next;
    }

    static _copy(source, owner) {
      const copy = new Sym(source.isTerminal, source.terminal, source.target, owner);
      if (copy.target !== null) copy.target.referrers.add(copy);
      return copy;
    }

    // Replaces the two symbols starting at `left` with a single reference to
    // `rule`, then restores both invariants around the splice.
    _substitute(left, rule) {
      const right = left.next;
      const owner = left.owner;
      const before = left.prev;
      const after = right.next;
      const beforePrev = before === null ? null : before.prev;

      this._removeDigram(before, left);
      this._removeDigram(left, right);
      this._removeDigram(right, after);

      const reference = new Sym(false, 0, rule, owner);
      reference.prev = before;
      reference.next = after;
      if (before !== null) before.next = reference; else owner.first = reference;
      if (after !== null) after.prev = reference; else owner.last = reference;
      rule.referrers.add(reference);

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
    _releaseOverlapSuppression(beforePrev, after) {
      this._check(beforePrev);
      this._check(after);
    }

    // Retires an occurrence and, when it was a rule reference, notes any rule
    // that has just become underused.
    _release(sym) {
      sym.dead = true;
      sym.prev = null;
      sym.next = null;
      if (sym.isTerminal) return;

      const target = sym.target;
      target.referrers.delete(sym);
      if (!target.dead && target.referrers.size === 1) this.underused.push(target);
    }

    // Splices the body of every rule that is down to one reference back into
    // that reference's place.
    _eliminateUnderused() {
      while (this.underused.length > 0) {
        const rule = this.underused.shift();
        if (rule.dead) continue;
        if (rule.referrers.size === 0) {
          // Nothing refers to it any more, so there is nothing to splice back.
          rule.dead = true;
          continue;
        }

        if (rule.referrers.size !== 1) continue;

        let only = null;
        rule.referrers.forEach(function(referrer) { only = referrer; });
        this._expand(rule, only);
      }
    }

    // Replaces the lone reference to `rule` by the rule's own body and retires
    // the rule.
    _expand(rule, reference) {
      const owner = reference.owner;
      const before = reference.prev;
      const after = reference.next;
      const beforePrev = before === null ? null : before.prev;

      this._removeDigram(before, reference);
      this._removeDigram(reference, after);

      const first = rule.first;
      const last = rule.last;
      for (let s = first; s !== null; s = s.next) s.owner = owner;

      first.prev = before;
      last.next = after;
      if (before !== null) before.next = first; else owner.first = first;
      if (after !== null) after.prev = last; else owner.last = last;

      rule.referrers.delete(reference);
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

  // Little-endian base-128 varint: 7 payload bits per byte, high bit marks
  // continuation.
  function writeVarUInt(out, value) {
    let v = value;
    while (v >= 0x80) {
      out.push(OpCodes.And32(OpCodes.Or32(v, 0x80), 0xFF));
      v = Math.floor(v / 128);
    }
    out.push(OpCodes.And32(v, 0xFF));
  }

  function readVarUInt(data, state) {
    let result = 0;
    let scale = 1;
    let b;
    do {
      if (state.offset >= data.length) throw new Error('Sequitur: truncated varint');
      b = data[state.offset++];
      result += OpCodes.And32(b, 0x7F) * scale;
      scale *= 128;
    } while (b >= 0x80);
    return result;
  }

  // Packs fixed-width codes most-significant-bit first onto the end of a byte
  // array.
  class BitWriter {
    constructor(output) {
      this.output = output;
      this.buffer = 0;
      this.count = 0;
    }

    write(value, bits) {
      for (let b = bits - 1; b >= 0; --b) {
        this.buffer = this.buffer * 2 + OpCodes.And32(OpCodes.Shr32(value, b), 1);
        if (++this.count !== 8) continue;
        this.output.push(this.buffer);
        this.buffer = 0;
        this.count = 0;
      }
    }

    // Writes a positive value as an Elias gamma code: its bit length minus one
    // in unary zeros, then the value itself. A rule body of the usual two
    // symbols therefore costs a single bit.
    writeGamma(value) {
      let bits = 1;
      while (Math.pow(2, bits) <= value) ++bits;
      this.write(0, bits - 1);
      this.write(value, bits);
    }

    flush() {
      while (this.count !== 0) this.write(0, 1);
    }
  }

  // Reads the fixed-width codes written by BitWriter.
  class BitReader {
    constructor(data, offset) {
      this.data = data;
      this.position = offset;
      this.buffer = 0;
      this.count = 0;
    }

    read(bits) {
      let value = 0;
      for (let i = 0; i < bits; ++i) {
        if (this.count === 0) {
          if (this.position >= this.data.length) throw new Error('Sequitur: truncated symbol stream');
          this.buffer = this.data[this.position++];
          this.count = 8;
        }
        --this.count;
        value = value * 2 + OpCodes.And32(OpCodes.Shr32(this.buffer, this.count), 1);
      }
      return value;
    }

    readGamma() {
      let leadingZeros = 0;
      while (this.read(1) === 0) {
        if (++leadingZeros > 31) throw new Error('Sequitur: malformed length code');
      }

      let value = 1;
      for (let i = 0; i < leadingZeros; ++i) value = value * 2 + this.read(1);
      return value;
    }
  }

  // The code width, in bits, that holds any rule index of a grammar with
  // ruleCount rules.
  function ruleBitsFor(ruleCount) {
    let bits = 1;
    while (Math.pow(2, bits) < ruleCount) ++bits;
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
      const lengthBytes = OpCodes.Unpack32LE(OpCodes.ToUint32(data.length));
      const out = [lengthBytes[0], lengthBytes[1], lengthBytes[2], lengthBytes[3]];
      if (data.length === 0) return out;

      const grammar = new Grammar();
      for (let i = 0; i < data.length; i++) grammar.append(OpCodes.And32(data[i], 0xFF));

      const rendered = grammar.render();
      const rules = rendered.rules;
      const startSequence = rendered.startSequence;

      writeVarUInt(out, rules.length);

      const ruleBits = ruleBitsFor(rules.length);
      const writer = new BitWriter(out);
      for (let i = 0; i < rules.length; ++i) writer.writeGamma(rules[i].length - 1);
      writer.writeGamma(startSequence.length);

      for (let i = 0; i < rules.length; ++i) {
        const body = rules[i];
        for (let k = 0; k < body.length; ++k) SequiturInstance._writeSymbol(writer, body[k], rules.length, ruleBits);
      }
      for (let k = 0; k < startSequence.length; ++k) SequiturInstance._writeSymbol(writer, startSequence[k], rules.length, ruleBits);
      writer.flush();

      return out;
    }

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

    static _readSymbol(reader, ruleCount, ruleBits) {
      if (ruleCount === 0) return reader.read(8);
      return reader.read(1) === 0 ? reader.read(8) : 256 + reader.read(ruleBits);
    }

    _decompress(data) {
      if (data.length === 0) return [];
      if (data.length < 4) throw new Error('Sequitur: truncated header');

      const originalSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      if (originalSize === 0) return [];

      const state = { offset: 4 };
      const ruleCount = readVarUInt(data, state);

      const ruleBits = ruleBitsFor(ruleCount);
      const reader = new BitReader(data, state.offset);

      const lengths = new Array(ruleCount + 1);
      for (let i = 0; i < ruleCount; ++i) lengths[i] = reader.readGamma() + 1;
      lengths[ruleCount] = reader.readGamma();

      const rules = new Array(ruleCount);
      for (let i = 0; i < ruleCount; ++i) {
        const body = new Array(lengths[i]);
        for (let k = 0; k < body.length; ++k) body[k] = SequiturInstance._readSymbol(reader, ruleCount, ruleBits);
        rules[i] = body;
      }

      const startSequence = new Array(lengths[ruleCount]);
      for (let k = 0; k < startSequence.length; ++k) startSequence[k] = SequiturInstance._readSymbol(reader, ruleCount, ruleBits);

      const result = new Array(originalSize);
      let resultPos = 0;

      const stack = [];
      for (let i = startSequence.length - 1; i >= 0; --i) stack.push(startSequence[i]);

      while (stack.length > 0) {
        const symbol = stack.pop();
        if (symbol < 256) {
          if (resultPos >= originalSize) throw new Error('Sequitur: grammar expands past the declared length');
          result[resultPos++] = symbol;
          continue;
        }

        const index = symbol - 256;
        if (index >= ruleCount) throw new Error('Sequitur: reference to a rule that does not exist');
        const body = rules[index];
        for (let i = body.length - 1; i >= 0; --i) stack.push(body[i]);
      }

      if (resultPos !== originalSize)
        throw new Error('Sequitur: decompressed size mismatch, expected ' + originalSize + ', got ' + resultPos);

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
