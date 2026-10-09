/**
 * PerlTranspileRegressions.js - regression tests for systematic Perl
 * transpilation faults (each case names the fault it pins down).
 *
 * Every case is Given (a JavaScript snippet) / When (transpiled to Perl, and
 * where the fault only shows at run time, run under perl with a small probe
 * appended) / Then (the generated code has a specific shape, or the probe
 * prints the value JavaScript computes). The run-time cases are skipped when
 * perl is not installed.
 *
 * The PERL category: node tests/TranspilerSuite.js --only=perl [--verbose]
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const CIPHER_DIR = path.join(__dirname, '..');
// Options of the current run, set by run()
let verbose = false;

// The transpiler logs progress on console.log; keep the suite output readable.
const realLog = console.log;
const quiet = fn => { console.log = () => {}; try { return fn(); } finally { console.log = realLog; } };

const { TypeAwareJSASTParser } = quiet(() => require(path.join(CIPHER_DIR, 'type-aware-transpiler.js')));
const { LanguagePlugins } = require(path.join(CIPHER_DIR, 'codingplugins', 'LanguagePlugin.js'));
// Loaded afresh: an earlier category in the same process (CODEGEN) clears the
// plugin registry, so a cached perl.js would never register again.
const PERL_PLUGIN = require.resolve(path.join(CIPHER_DIR, 'codingplugins', 'perl.js'));
delete require.cache[PERL_PLUGIN];
quiet(() => require(PERL_PLUGIN));
const plugin = LanguagePlugins.GetAll().find(p => p.name === 'Perl');

// What every algorithm file destructures from the framework.
const FRAMEWORK_PRELUDE = 'const { RegisterAlgorithm, Algorithm, BlockCipherAlgorithm, HashFunctionAlgorithm, ' +
  'IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, BlockAbsorber, SpongePadBlocks, ' +
  'MerkleDamgardBlocks, KeySize, TestCase } = AlgorithmFramework;\n';

/**
 * @param {string} js - JavaScript source
 * @returns {string} the Perl translation
 */
function transpile(js) {
  return quiet(() => {
    const ast = new TypeAwareJSASTParser(js).parse();
    const result = plugin.GenerateFromAST(ast, { generateTestHarness: false, inlineOpCodes: true });
    if (!result.success) throw new Error(result.error || 'transpile failed');
    return result.code;
  });
}

let perlAvailable = null;
function hasPerl() {
  if (perlAvailable === null) {
    const probe = spawnSync('perl', ['-v'], { encoding: 'utf-8' });
    perlAvailable = probe.status === 0;
  }
  return perlAvailable;
}

/**
 * Transpile, append a Perl probe, and run it.
 * @param {string} js - JavaScript source
 * @param {string} probe - Perl statements printing the observed values
 * @returns {string} what perl printed (stdout and stderr)
 */
function runPerl(js, probe) {
  const code = transpile(js);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'perl-regression-'));
  try {
    const file = path.join(dir, 'probe.pl');
    fs.writeFileSync(file, `${code}\npackage main;\n${probe}\n`);
    const run = spawnSync('perl', [file], { encoding: 'utf-8', timeout: 60000 });
    const out = (run.stdout || '') + (run.stderr || '');
    if (run.status !== 0) throw new Error(`perl exited ${run.status}:\n${out.slice(0, 1500)}${verbose ? '\n' + code : ''}`);
    return out;
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* temp dir cleanup is best effort */ }
  }
}

const cases = require('./UnitCases.js').createCases();
const check = cases.case;
function expectMatch(code, re, what) {
  if (!re.test(code)) throw new Error(`expected ${what} (${re})\n${verbose ? code : ''}`);
}
function expectNoMatch(code, re, what) {
  if (re.test(code)) throw new Error(`did not expect ${what} (${re})\n${verbose ? code : ''}`);
}
function expectOutput(out, want) {
  const got = out.split('\n').filter(l => !/^(Subroutine \w+ redefined|.*non-portable)/.test(l)).join('\n').trim();
  if (got !== want) throw new Error(`expected output\n${want}\ngot\n${got}`);
}

// ---------------------------------------------------------------------------
// Framework runtime: inherited behaviour of AlgorithmFramework.js
// ---------------------------------------------------------------------------
check('framework: an instance without its own Feed inherits the accumulating Feed', () => {
  if (!hasPerl()) return 'skip';
  const out = runPerl(FRAMEWORK_PRELUDE +
    'class EchoInstance extends IAlgorithmInstance {\n' +
    '  constructor(algorithm) { super(algorithm); }\n' +
    '  /** @returns {uint8[]} */ Result() { const out = this.inputBuffer.slice(); this.inputBuffer = []; return out; }\n}',
    'my $i = EchoInstance->new(undef); $i->Feed([1, 2]); $i->Feed([]); $i->Feed([3]);\n' +
    'print join(",", @{$i->Result()}), "|", (defined $i->{isInverse} ? $i->{isInverse} : "undef"), "\\n";');
  expectOutput(out, '1,2,3|0');
});
check('framework: a block cipher without its own Result inherits the block loop, key accessor and block-multiple check', () => {
  if (!hasPerl()) return 'skip';
  const out = runPerl(FRAMEWORK_PRELUDE +
    'class SwapInstance extends IBlockCipherInstance {\n' +
    '  constructor(algorithm, isInverse) { super(algorithm); this.isInverse = isInverse; this.BlockSize = 2; }\n' +
    '  /** @param {uint8[]} b @returns {uint8[]} */ EncryptBlock(b) { return [b[1], b[0]]; }\n' +
    '  /** @param {uint8[]} b @returns {uint8[]} */ DecryptBlock(b) { return [b[1], (b[0] + 1) & 255]; }\n}',
    'my $e = SwapInstance->new(undef, 0); $e->key([9]); $e->Feed([1, 2, 3, 4]); print join(",", @{$e->Result()}), "\\n";\n' +
    'my $d = SwapInstance->new(undef, 1); $d->key([9]); $d->Feed([1, 2]); print join(",", @{$d->Result()}), "\\n";\n' +
    'my $odd = SwapInstance->new(undef, 0); $odd->key([9]); $odd->Feed([1, 2, 3]); eval { $odd->Result() }; print $@ =~ /multiple of 2/ ? "refused" : "accepted", "\\n";\n' +
    'my $nokey = SwapInstance->new(undef, 0); $nokey->Feed([1, 2]); eval { $nokey->Result() }; print $@ =~ /Key not set/ ? "refused" : "accepted", "\\n";');
  expectOutput(out, '2,1,4,3\n2,2\nrefused\nrefused');
});
check('framework: BlockAbsorber holds the last full block back; MerkleDamgardBlocks pads at the 55/56-byte boundary', () => {
  if (!hasPerl()) return 'skip';
  const out = runPerl(FRAMEWORK_PRELUDE +
    'class H {\n  constructor() { this.seen = []; this.absorber = new BlockAbsorber(4, b => { this.seen.push(b[0]); }); }\n' +
    '  /** @param {uint8[]} d */ add(d) { this.absorber.Absorb(d); }\n' +
    '  /** @returns {int} */ blocks() { let n = 0; this.absorber.Finish((held, pending, total) => { for (const block of MerkleDamgardBlocks(held, pending, total, { blockSize: 64, lengthBytes: 8 })) n += block.length; }); return n; }\n}',
    'my $h = H->new(); $h->add([1, 2, 3, 4]); print scalar(@{$h->{seen}}), "\\n"; $h->add([5]); print join(",", @{$h->{seen}}), "\\n";\n' +
    'print $h->blocks(), "\\n";\n' +
    'print scalar(@{main::MerkleDamgardBlocks([(0) x 55], 55, 55, {blockSize => 64, lengthBytes => 8})}), ",",\n' +
    '  scalar(@{main::MerkleDamgardBlocks([(0) x 56], 56, 56, {blockSize => 64, lengthBytes => 8})}), "\\n";\n' +
    'print join(",", @{main::SpongePadBlocks([1, 2, 3], 3, 4, 6)->[0]}), "\\n";');
  expectOutput(out, '0\n1\n64\n1,2\n1,2,3,134');
});
check('framework: a super(...) call into a framework base chains into its BUILD', () => {
  const code = transpile(FRAMEWORK_PRELUDE + 'class K extends IHashFunctionInstance { constructor(a) { super(a); this.OutputSize = 32; } }');
  expectMatch(code, /\$self->SUPER::BUILD\(\$a\)/, '$self->SUPER::BUILD($a)');
});

// ---------------------------------------------------------------------------
// Signatures: JavaScript ignores surplus arguments
// ---------------------------------------------------------------------------
check('signatures: a callback declaring fewer parameters than it is passed still runs', () => {
  const code = transpile('/** @param {function(int, int, int): int} f @returns {int} */ function apply(f) { return f(1, 2, 3); }\n' +
    '/** @returns {int} */ function g() { return apply((a, b) => a + b); }');
  expectMatch(code, /sub \(\$a = undef, \$b = undef, @\)/, 'an anonymous sub ending in a nameless slurpy');
  if (!hasPerl()) return 'skip';
  expectOutput(runPerl('/** @param {function(int, int, int): int} f @returns {int} */ function apply(f) { return f(1, 2, 3); }\n' +
    '/** @returns {int} */ function g() { return apply((a, b) => a + b); }', 'print main::g(), "\\n";'), '3');
});

// ---------------------------------------------------------------------------
// IL node types with no Perl translation
// ---------------------------------------------------------------------------
const MATH_SNIPPET = '/** @param {int32} a @param {int32} b @returns {string} */\n' +
  'function f(a, b) { const o = { x: 1, y: 2 }; delete o.x;\n' +
  '  return [Math.trunc((a - b) / 2), Math.floor((a - b) / 2), Math.clz32(a), Math.clz32(0), o.x === undefined ? 1 : 0, o.y].join(","); }';
check('IL: Math.trunc, Math.clz32 and delete are translated, not dropped', () => {
  const code = transpile(MATH_SNIPPET);
  expectNoMatch(code.slice(code.indexOf('sub f ')), /[-+=,]\s*[;)]/, 'an expression with a missing operand');
  expectMatch(code, /delete\(\$o->\{'x'\}\)/, 'delete($o->{x})');
  if (!hasPerl()) return 'skip';
  // JavaScript: f(1, 8) is "-3,-4,31,32,1,2"
  expectOutput(runPerl(MATH_SNIPPET, 'print main::f(1, 8), "\\n";'), '-3,-4,31,32,1,2');
});
check('modules: a module used only through qualified calls imports nothing', () => {
  const code = transpile('/** @param {number} x @returns {number} */ function f(x) { return Math.floor(x) + Math.ceil(x); }');
  expectMatch(code, /use POSIX \(\);/, 'use POSIX ();');
});

// ---------------------------------------------------------------------------
// Packages: module-scope functions live in package main
// ---------------------------------------------------------------------------
check('packages: a class calling a helper declared below it reaches main::helper', () => {
  const js = 'class Cell { constructor() { /** @type {int32} */ this.v = triple(2); } }\n' +
    '/** @param {int32} x @returns {int32} */ function triple(x) { return x * 3; }';
  expectMatch(transpile(js), /main::triple\(2\)/, 'main::triple(2)');
  if (!hasPerl()) return 'skip';
  expectOutput(runPerl(js, 'print Cell->new()->{v}, "\\n";'), '6');
});

// ---------------------------------------------------------------------------
// OpCodes runtime: every OpCodes function an algorithm calls exists
// ---------------------------------------------------------------------------
check('OpCodes runtime: conversions, hex tables, secure random bytes and BitStream word writers', () => {
  if (!hasPerl()) return 'skip';
  const js = '/** @returns {string} */ function probe() {\n' +
    '  const s = OpCodes.CreateBitStream(); s.writeUint32LE(0x01020304); s.writeUint16BE(0x0506);\n' +
    '  const pairs = OpCodes.CreateUint64ArrayFromHex(["0x0123456789ABCDEF", "FF"]);\n' +
    '  return [OpCodes.ToShort(0x18000), OpCodes.UintToByte(0x1FF), OpCodes.BytesToChars([72, 105]),\n' +
    '    OpCodes.BytesToWords32BE([1, 2, 3, 4, 5]).join("/"), pairs[0][0], pairs[0][1], pairs[1][1],\n' +
    '    OpCodes.SecureRandomBytes(5).length, s.toArray().join("/"), Number(OpCodes.ToLong(-5n))].join(","); }';
  // JavaScript: probe() is "-32768,255,Hi,16909060/83886080,19088743,2309737967,255,5,4/3/2/1/5/6,-5"
  expectOutput(runPerl(js, 'print main::probe(), "\\n";'), '-32768,255,Hi,16909060/83886080,19088743,2309737967,255,5,4/3/2/1/5/6,-5');
});

check('builtins: ArrayBuffer.isView accepts an array as Array.isArray does', () => {
  const js = '/** @param {uint8[]} k @returns {boolean} */ function ok(k) { return ArrayBuffer.isView(k) || Array.isArray(k); }';
  expectMatch(transpile(js), /ref\(\$k\) eq 'ARRAY'.*ref\(\$k\) eq 'ARRAY'/, "two ref($k) eq 'ARRAY' tests");
});

// ---------------------------------------------------------------------------
// Property setters run their code, chosen by the object's IL type
// ---------------------------------------------------------------------------
const SETTER_SNIPPET =
  'class Local { constructor() { this._k = null; } set k(v) { this._k = v * 2; } get k() { return this._k + 1; } }\n' +
  '/** @param {Local} local @param {Foreign} foreign @returns {string} */\n' +
  'function use(local, foreign) { local.k = 5; foreign.key = 7; foreign.plain = 3; return [local.k, foreign.key, foreign.plain].join(","); }';
check('setters: a same-file class setter is called; another file\'s class is resolved at run time', () => {
  const code = transpile(SETTER_SNIPPET);
  expectMatch(code, /\$local->k\(5\)/, '$local->k(5)');
  expectMatch(code, /main::_JsSetProp\(\$foreign, 'key', 7\)/, "main::_JsSetProp($foreign, 'key', 7)");
  if (!hasPerl()) return 'skip';
  // JavaScript (Foreign with a key accessor doubling the value): "11,14,3"
  const out = runPerl(SETTER_SNIPPET,
    'package Foreign; sub new { bless {}, shift } sub key { my $s = shift; if (@_) { $s->{_key} = 2 * shift; return; } return $s->{_key}; }\n' +
    'package main; print main::use(Local->new(), Foreign->new()), "\\n";');
  expectOutput(out, '11,14,3');
});
check('setters: a subclass assigning the framework key property goes through IBlockCipherInstance.key', () => {
  const code = transpile(FRAMEWORK_PRELUDE +
    'class C extends IBlockCipherInstance { constructor(a) { super(a); } reset(k) { this.key = k; } }');
  expectMatch(code, /\$self->key\(\$k\)/, '$self->key($k)');
});

// ---------------------------------------------------------------------------
// Spread
// ---------------------------------------------------------------------------
const SPREAD_SNIPPET = '/** @param {uint8[]} key @param {string} s @returns {string} */\n' +
  'function f(key, s) { const t = [0, 0, 0, 0, 9]; t.splice(0, 2, ...key.slice(0, 2)); return t.join("") + "|" + [...s].length; }';
check('spread: a spread call argument of any shape is flattened; a spread string yields characters', () => {
  if (!hasPerl()) return 'skip';
  // JavaScript: f([1, 2, 3], "abc") is "12009|3"
  expectOutput(runPerl(SPREAD_SNIPPET, 'print main::f([1, 2, 3], "abc"), "\\n";'), '12009|3');
});

// ---------------------------------------------------------------------------
// Arrays mutated in place: reverse, sort with a comparator, splice
// ---------------------------------------------------------------------------
const ARRAY_SNIPPET = '/** @param {int32[]} a @returns {string} */\n' +
  'function f(a) { a.reverse(); const b = a.slice(); b.sort((x, y) => x - y); a.splice(0, 1);\n' +
  '  const c = [10, 9, 1]; const d = c.sort(); return [a.join("/"), b.join("/"), d.join("/"), c === d ? 1 : 0].join(","); }';
check('arrays: reverse and sort work in place; a comparator gets its operands as arguments', () => {
  if (!hasPerl()) return 'skip';
  // JavaScript: f([3, 1, 2]) is "1/3,1/2/3,1/10/9,1"
  const out = runPerl(ARRAY_SNIPPET, 'print main::f([3, 1, 2]), "\\n";');
  expectOutput(out, '1/3,1/2/3,1/10/9,1');
  expectNoMatch(out, /Useless use/, 'a void-context warning');
});

// ---------------------------------------------------------------------------
// Types are per binding: the IL type of the node decides, not its name
// ---------------------------------------------------------------------------
const LEAK_SNIPPET = 'class N {\n  constructor() { /** @type {uint8[]} */ this.nonce = [1, 2, 3]; }\n' +
  '  /** @returns {int32} */ f() { /** @type {string} */ const nonce = "ab"; this.nonce[0] = 7; return nonce.length + this.nonce[0] + this.nonce[1]; }\n}';
check('types: a local string does not make a same-named byte-array field a string', () => {
  const code = transpile(LEAK_SNIPPET);
  expectNoMatch(code, /substr\(\$self->\{'nonce'\}/, "substr($self->{'nonce'}, ...)");
  if (!hasPerl()) return 'skip';
  // JavaScript: new N().f() is 11
  expectOutput(runPerl(LEAK_SNIPPET, 'print N->new()->f(), "\\n";'), '11');
});

check('strings: a "+" chain of hundreds of string literals is one literal (no stack overflow)', () => {
  const parts = Array.from({ length: 2000 }, (_, i) => `'${(i % 16).toString(16)}'`);
  const code = transpile(`/** @returns {string} */ function hex() { return ${parts.join(' +\n')}; }`);
  expectMatch(code, /return '0123456789abcdef0123/, 'the folded literal');
});

// ---------------------------------------------------------------------------
// BigInt: arbitrary precision by the IL type
// ---------------------------------------------------------------------------
const BIGINT_SNIPPET = '/** @param {BigInt} a @param {int32} n @returns {string} */\n' +
  'function f(a, n) { let r = BigInt(n); r += a * 3n; const q = (-r) / 7n; const m = (-r) % 7n;\n' +
  '  const w = OpCodes.ToQWord(a * a); return [r.toString(16), q, m, Number(r & 0xFFn), w, (r << 70n) >> 69n].join(","); }';
check('BigInt: products, truncating division and remainder, toString(16) and ToQWord keep JavaScript semantics', () => {
  if (!hasPerl()) return 'skip';
  // JavaScript: f(2n ** 64n + 5n, -2) is "3000000000000000d,-7905747460161236408,-5,13,25,110680464442257309722"
  const out = runPerl(BIGINT_SNIPPET, 'print main::f(Math::BigInt->new(2)->bpow(64)->badd(5), -2), "\\n";');
  expectOutput(out, '3000000000000000d,-7905747460161236408,-5,13,25,110680464442257309722');
});

// ---------------------------------------------------------------------------
// .length by the receiver's IL type
// ---------------------------------------------------------------------------
const LENGTH_SNIPPET = '/**\n * @typedef {Object} Match\n * @property {int32} distance\n * @property {int32} length\n */\n' +
  '/** @param {uint8[]} data @param {string} text @returns {string} */\n' +
  'function f(data, text) { /** @type {Match} */ const match = { distance: 3, length: 9 }; return [match.length, data.length, text.length].join(","); }';
check('length: a record\'s length field is a field, an array counts elements, a string characters', () => {
  const code = transpile(LENGTH_SNIPPET);
  expectMatch(code, /\$match->\{'length'\}/, "$match->{'length'}");
  if (!hasPerl()) return 'skip';
  expectOutput(runPerl(LENGTH_SNIPPET, 'print main::f([1, 2], "abcd"), "\\n";'), '9,2,4');
});

// ---------------------------------------------------------------------------
// Numbers and Math
// ---------------------------------------------------------------------------
const NUMBER_SNIPPET = '/** @param {number} x @returns {string} */\n' +
  'function f(x) { return [Number.MAX_VALUE > 1e300 ? 1 : 0, 2 ** 70 === 1180591620717411303424 ? 1 : 0, Math.round(Math.tanh(x) * 1000), Math.round(Math.cosh(x) * 1000)].join(","); }';
check('numbers: a double beyond 64 bits is a float literal; Math.tanh/sinh/cosh read their argument', () => {
  const code = transpile(NUMBER_SNIPPET);
  expectNoMatch(code, /\d{21,}/, 'an integer literal of more than 20 digits');
  if (!hasPerl()) return 'skip';
  // JavaScript: f(0.5) is "1,1,462,1128"
  expectOutput(runPerl(NUMBER_SNIPPET, 'print main::f(0.5), "\\n";'), '1,1,462,1128');
});

const FLOAT_SNIPPET = '/** @type {BigInt} */ const BIG = 1n;\n' +
  '/** @param {int32} radix @returns {int32} */ function maxLength(radix) { return 2 * Math.floor(96 * Math.LN2 / Math.log(radix)); }\n' +
  'class Reg { constructor() { /** @type {int32} */ this.length = 0; } }\n' +
  '/** @param {int32} n @returns {int32} */ function regLength(n) { const r = new Reg(); r.length = n; return r.length; }';
check('numbers: float arithmetic stays floating point in a BigInt file; obj.length = n on a class sets the field', () => {
  if (!hasPerl()) return 'skip';
  // JavaScript: maxLength(10) is 56, regLength(5) is 5
  expectOutput(runPerl(FLOAT_SNIPPET, 'print main::maxLength(10), ",", main::regLength(5), "\\n";'), '56,5');
});

check('arrays: arr.length = n truncates and extends', () => {
  if (!hasPerl()) return 'skip';
  const js = '/** @param {int32[]} a @returns {int32} */ function f(a) { a.length = 5; const n = a.length; a.length = 2; return n * 10 + a.length; }';
  expectOutput(runPerl(js, 'print main::f([1, 2, 3]), "\\n";'), '52');
});

// ---------------------------------------------------------------------------
// typeof, and a field sharing its name with another class's method
// ---------------------------------------------------------------------------
const TYPEOF_SNIPPET = 'class Score { constructor(x) { /** @type {float64} */ this.chi = x; } }\n' +
  'class Stats { /** @param {int32} a @returns {int32} */ chi(a) { return a * 2; } }\n' +
  '/** @param {uint8[]} data @param {string} s @returns {string} */\n' +
  'function f(data, s) { const sc = new Score(1.5); return [typeof data, typeof s, typeof 5, typeof undefined, typeof 5n, sc.chi, new Stats().chi(4)].join(","); }';
check('typeof gives JavaScript\'s names; a field named like another class\'s method stays a field', () => {
  const code = transpile(TYPEOF_SNIPPET);
  expectNoMatch(code, /->can\('chi'\) =/, "an assignment to $self->can('chi')");
  if (!hasPerl()) return 'skip';
  expectOutput(runPerl(TYPEOF_SNIPPET, 'print main::f([1], "x"), "\\n";'), 'object,string,number,undefined,bigint,1.5,8');
});

const DOUBLE_SNIPPET = '/** @param {uint32} mix @returns {string} */\n' +
  'function lcg(mix) { /** @type {int32} */ let seed = OpCodes.ToInt(mix); /** @type {float64} */ const M = 1103515245;\n' +
  '  /** @type {float64} */ const product = M * seed + 12345; return [product < 0 ? 1 : 0, OpCodes.ToInt(OpCodes.And32(product, 0x7fffffff))].join(","); }';
check('numbers: float64 arithmetic rounds as doubles do and reads an int32 with its sign', () => {
  if (!hasPerl()) return 'skip';
  // JavaScript: lcg(0x89ABCDEF) is "1,1824502016"
  expectOutput(runPerl(DOUBLE_SNIPPET, 'print main::lcg(0x89ABCDEF), "\\n";'), '1,1824502016');
});

const MULTIPLY_SNIPPET = '/** @param {uint32} value @returns {uint32} */ function h(value) { return OpCodes.ToUint32((value|0) * 0x27d4eb2d); }\n' +
  '/** @returns {string} */ function f() { return [h(0x9E3779B9), h(12345), OpCodes.Mul32(0x9E3779B9, 0x85EBCA6B)].join(","); }';
check('numbers: a raw 32-bit product is a rounded double of signed operands; Mul32 keeps the exact low bits', () => {
  if (!hasPerl()) return 'skip';
  // JavaScript: f() is "3098622080,3397438725,3238976083"
  expectOutput(runPerl(MULTIPLY_SNIPPET, 'print main::f(), "\\n";'), '3098622080,3397438725,3238976083');
});

const FIND_SNIPPET = '/** @returns {string} */ function f() {\n' +
  '  const kat = [{ set: "a", pk: 1 }, { set: "b", pk: 2 }];\n' +
  '  const v = new Uint8Array([1, 2, 3, 4, 5]); const tail = v.subarray(-2); const mid = v.subarray(1, -1); mid[0] = 9;\n' +
  '  return [kat.find(e => e.set === "b").pk, tail.length, mid.length, v[1], v.subarray(4, 2).length].join(","); }';
check('arrays: .find(fn).prop reads the found element; subarray takes negative and inverted bounds', () => {
  if (!hasPerl()) return 'skip';
  // JavaScript: f() is "2,2,3,9,0"
  expectOutput(runPerl(FIND_SNIPPET, 'print main::f(), "\\n";'), '2,2,3,9,0');
});

/**
 * PERL: run every regression case.
 * @param {object} options - { verbose }
 * @returns {object} { passed, failed, skipped, detail }
 */
function run(options = {}) {
  verbose = Boolean(options.verbose);
  realLog('Perl transpile regression suite');
  return cases.run({ verbose });
}

module.exports = { run };
