/**
 * TranspilerValidationTests.js - unit tests of the cross-language validation
 * (TranspilerValidation.js): how a vector is planned from its reference run,
 * how a harness run is read back, how languages are judged and errors
 * classified, and - end to end, with hand-written stand-ins for transpiled
 * code - that each vector harness applies fields strictly and reports every
 * failure instead of swallowing it. Every case is Given / When / Then.
 *
 * The HARNESS category: node tests/TranspilerSuite.js --only=harness
 * (the C# cases need the .NET SDK and are skipped by --no-dotnet)
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const Validation = require('./TranspilerValidation.js');
const { createCases } = require('./UnitCases.js');

const cases = createCases();
const test = cases.case;

function equal(actual, expected, what = '') {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what}expected ${e}, got ${a}`);
}
function contains(text, part, what = '') {
  if (!String(text).includes(part)) throw new Error(`${what}expected "${part}" in "${text}"`);
}

// ---------------------------------------------------------------- vector plans

const CATEGORIES = { ASYMMETRIC: 'asymmetric' };
const plan = (vector, roundTripSuccess = null, algorithm = { category: 'block' }, isMode = false) =>
  Validation.vectorPlan(algorithm, vector, { roundTripSuccess }, isMode, CATEGORIES);

test('vectorPlan: given key, iv, nonce, an own field and a seed, when planned, then setter fields in TestEngine order, own fields by property, seed last', () => {
  const p = plan({ input: [1], expected: [2], text: 't', uri: 'u', seed: [9], rounds: 8, nonce: [3], iv: [4], key: [5] });
  equal(p.steps.map(s => [s.field, s.setter || null]), [['key', 'setKey'], ['iv', 'setIV'], ['nonce', 'setNonce'], ['rounds', null], ['seed', 'setSeed']]);
  equal(p.fields, ['seed', 'rounds', 'nonce', 'iv', 'key']);
});
test('vectorPlan: given a kek, when planned, then it is applied first and marked as a key-encryption key', () => {
  equal(plan({ input: [1], expected: [2], key: [1], kek: [2] }).steps[0], { field: 'kek', kind: 'kek' });
});
test('vectorPlan: given framework, descriptive and undefined fields, when planned, then none is a field to apply', () => {
  equal(plan({ input: [1], expected: [], text: 'x', uri: 'y', inverse: true, roundTripOnly: true, skipped: undefined }).fields, []);
});
test('vectorPlan: given a field whose value is null, when planned, then the step says so', () => {
  equal(plan({ input: [1], expected: [2], tag: null }).steps, [{ field: 'tag', isNull: true, setter: 'setTag' }]);
});
test('vectorPlan: given an expected output, when planned, then it is checked; given none, then it is not', () => {
  equal([plan({ input: [1], expected: [2] }).expect, plan({ input: [1], expected: [] }).expect, plan({ input: [1] }).expect], [true, false, false]);
});
test('vectorPlan: given an asymmetric vector whose expected value is its input, when planned, then only the round trip counts', () => {
  const asymmetric = { category: 'asymmetric' };
  equal([plan({ input: [1, 2], expected: [1, 2] }, true, asymmetric).expect, plan({ input: [1, 2], expected: [3, 4] }, true, asymmetric).expect], [false, true]);
});
test('vectorPlan: given the reference round trip succeeded, failed or was not made, when planned, then decode, none, none', () => {
  equal([plan({ input: [1], expected: [2] }, true).rt, plan({ input: [1], expected: [2] }, false).rt, plan({ input: [1], expected: [2] }, null).rt],
    ['decode', null, null]);
});
test('vectorPlan: given an encoding algorithm whose round trip succeeded, when planned, then encoding stability is checked', () => {
  equal(plan({ input: [1], expected: [2] }, true, { category: { name: 'Encoding Schemes' } }).rt, 'stability');
});
test('vectorPlan: given a mode vector with a cipher, a key and an empty IV, when planned, then the mode setup keeps JavaScript truthiness', () => {
  equal(plan({ input: [1], expected: [2], cipher: 'AES', key: [], iv: [] }, null, { category: 'mode' }, true).mode,
    { cipher: 'AES', keyTruthy: true, ivTruthy: true });
  equal(plan({ input: [1], expected: [2] }, null, { category: 'mode' }, true).mode, { cipher: null, keyTruthy: false, ivTruthy: false });
});

// ---------------------------------------------------------------- reading a run back

const spec2 = { algorithms: [{ vectors: [{}, {}, {}] }, { vectors: [{}, {}] }] };
const runOf = (stdout, extra = {}) => Object.assign({ stdout, stderr: '', exitCode: 0, timedOut: false, error: null }, extra);

test('parseHarnessOutput: given every vector passing and @@DONE, when read, then every algorithm passes', () => {
  const out = '@@VEC 0 0 PASS\n@@VEC 0 1 PASS\n@@VEC 0 2 PASS\n@@VEC 1 0 PASS\n@@VEC 1 1 PASS\n@@DONE\n';
  equal(Validation.parseHarnessOutput(spec2, runOf(out), 'python'), [{ passed: 3, total: 3, error: null }, { passed: 2, total: 2, error: null }]);
});
test('parseHarnessOutput: given one failing vector, when read, then that algorithm fails with the first failure and its count', () => {
  const out = '@@VEC 0 0 PASS\n@@VEC 0 1 FAIL output 01 expected 02\n@@VEC 0 2 FAIL second\n@@VEC 1 0 PASS\n@@VEC 1 1 PASS\n@@DONE\n';
  const r = Validation.parseHarnessOutput(spec2, runOf(out), 'python');
  equal(r[0], { passed: 1, total: 3, error: 'vector 1: output 01 expected 02' });
  equal(r[1].error, null);
});
test('parseHarnessOutput: given a crash after the first vector, when read, then the cut-short algorithms fail with the crash message', () => {
  const stderr = 'Traceback (most recent call last):\n  File "t.py", line 3, in <module>\nNameError: name \'x\' is not defined\n';
  const r = Validation.parseHarnessOutput(spec2, runOf('@@VEC 0 0 PASS\n', { stderr, exitCode: 1 }), 'python');
  equal(r.map(x => [x.passed, x.error]), [[1, "NameError: name 'x' is not defined"], [0, "NameError: name 'x' is not defined"]]);
});
test('parseHarnessOutput: given a timeout, when read, then the error says so', () => {
  contains(Validation.parseHarnessOutput(spec2, runOf('', { timedOut: true, exitCode: null }), 'perl')[0].error, 'timed out after');
});
test('parseHarnessOutput: given a missing algorithm, when read, then it fails with the harness message and no vector passed', () => {
  const out = "@@ALGO 0 MISSING no algorithm named 'X' is registered\n@@VEC 1 0 PASS\n@@VEC 1 1 PASS\n@@DONE\n";
  equal(Validation.parseHarnessOutput(spec2, runOf(out), 'javascript')[0], { passed: 0, total: 3, error: "no algorithm named 'X' is registered" });
});
test('parseHarnessOutput: given a transpiled vector count differing from the reference, when read, then it fails although its vectors passed', () => {
  const out = '@@ALGO 1 COUNT 1\n@@VEC 0 0 PASS\n@@VEC 0 1 PASS\n@@VEC 0 2 PASS\n@@VEC 1 0 PASS\n@@VEC 1 1 FAIL vector missing\n@@DONE\n';
  contains(Validation.parseHarnessOutput(spec2, runOf(out), 'csharp')[1].error, 'has 1 vectors, the reference 2');
});
test('parseHarnessOutput: given a non-zero exit after every vector passed, when read, then the algorithms fail', () => {
  const out = '@@VEC 0 0 PASS\n@@VEC 0 1 PASS\n@@VEC 0 2 PASS\n@@VEC 1 0 PASS\n@@VEC 1 1 PASS\n@@DONE\n';
  contains(Validation.parseHarnessOutput(spec2, runOf(out, { exitCode: 3, stderr: 'boom' }), 'perl')[0].error, 'exited with code 3');
});
test('parseHarnessOutput: given no output at all, when read, then the error comes from stderr', () => {
  const r = Validation.parseHarnessOutput(spec2, runOf('', { exitCode: 1, stderr: 'ReferenceError: foo is not defined\n    at x.js:1:1' }), 'javascript');
  equal(r[0].error, 'ReferenceError: foo is not defined');
});

// ---------------------------------------------------------------- judging languages

const record = (language, stage, errorClass = null) => ({ file: 'block/x.js', category: 'block', algorithm: 'X', language, stage, errorClass });

test('summarize: given a transpiled algorithm that compiled but failed a vector, when judged, then its language fails', () => {
  const s = Validation.summarize([record('python', 'passed'), record('python', 'execute', 'execute: wrong output')], ['python']).byLanguage.python;
  equal([s.considered, s.transpiled, s.compiled, s.executed, s.passed], [2, 2, 2, 1, false]);
});
test('summarize: given only passes and transpile failures, when judged, then the language passes and counts the transpile failure', () => {
  const s = Validation.summarize([record('perl', 'passed'), record('perl', 'transpile', 'transpile: x')], ['perl']).byLanguage.perl;
  equal([s.considered, s.transpiled, s.compiled, s.executed, s.passed], [2, 1, 1, 1, true]);
});
test('summarize: given a compile failure, when judged, then the language fails', () => {
  equal(Validation.summarize([record('csharp', 'compile', 'compile: CS0103')], ['csharp']).byLanguage.csharp.passed, false);
});
test('summarize: given a worker that died, when judged, then the language fails', () => {
  equal(Validation.summarize([record('csharp', 'harness', 'harness: worker died')], ['csharp']).byLanguage.csharp.passed, false);
});
test('summarize: given a compile-only run, when judged, then compiled is enough', () => {
  equal(Validation.summarize([record('javascript', 'compiled')], ['javascript']).byLanguage.javascript.passed, true);
});
test('summarize: given a run cut off by its time limit, when judged, then it is counted as timed out and fails no language', () => {
  const s = Validation.summarize([record('python', 'passed'), Object.assign(record('python', 'timeout', 'timeout: timeout'), { error: 'timed out after 120s' })], ['python']).byLanguage.python;
  equal([s.considered, s.compiled, s.executed, s.timedOut, s.passed], [2, 2, 1, 1, true]);
});
test('summarize: given error classes, when ranked, then by count descending and name ascending', () => {
  const s = Validation.summarize([record('perl', 'execute', 'b'), record('perl', 'execute', 'a'), record('perl', 'execute', 'b'), record('perl', 'compile', 'c')], ['perl']);
  equal(s.byLanguage.perl.errorClasses, [{ class: 'b', count: 2 }, { class: 'a', count: 1 }, { class: 'c', count: 1 }]);
});
test('summarize: given records of two categories, when summarized, then each category counts its own', () => {
  const s = Validation.summarize([record('perl', 'passed'), Object.assign(record('perl', 'compile'), { category: 'hash' })], ['perl']);
  equal([s.byCategory.block.perl.executed, s.byCategory.hash.perl.compiled], [1, 0]);
});

// ---------------------------------------------------------------- error classes

test('errorClass: given a C# compiler error, when classified, then the compiler code', () => {
  equal(Validation.errorClass('compile', "error CS0103: The name 'x' does not exist"), 'compile: CS0103');
});
test('errorClass: given wrong output, a failed round trip and an unapplied field, when classified, then their kinds', () => {
  equal([Validation.errorClass('execute', 'vector 2: output 00 expected 01'),
    Validation.errorClass('execute', 'vector 0: round trip gave 00 expected the input 01'),
    Validation.errorClass('execute', "vector 0: Vector field 'counter' is not applied: X has no setter or property of that name")],
  ['execute: wrong output', 'execute: round trip does not invert', 'execute: field not applied: counter']);
});
test('errorClass: given missing-member errors, when classified, then the member is kept and the owner blanked', () => {
  equal([Validation.errorClass('execute', "AttributeError: 'GcmInstance' object has no attribute 'set_aad'"),
    Validation.errorClass('execute', 'Can\'t locate object method "setIV" via package "Foo" at D:\\Working Copies\\t.pl line 5.')],
  ["execute: AttributeError: no attribute 'set_aad'", "execute: Can't locate object method 'setIV'"]);
});
test('errorClass: given a Perl error with a path containing spaces, when classified, then the location is dropped', () => {
  equal(Validation.errorClass('execute', 'Not an ARRAY reference at D:\\Working Copies\\out\\test.pl line 1234.'), 'execute: Not an ARRAY reference');
});
test('errorClass: given a pass or no error, when classified, then no class', () => {
  equal([Validation.errorClass('passed', null), Validation.errorClass('compiled', null)], [null, null]);
});

// ---------------------------------------------------------------- toolchain detection

/**
 * Run a case with fake tools first on PATH: each is a .cmd shim on Windows
 * (the shape npm and kotlinc install) or a shell script elsewhere.
 * @param {Object<string, {stdout?: string, stderr?: string, code?: number}>} tools - name -> behaviour
 * @param {function(): void} body - the case
 */
function withFakeTools(tools, body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-tools-'));
  const savedPath = process.env.PATH;
  try {
    for (const [name, t] of Object.entries(tools)) {
      if (process.platform === 'win32') {
        const lines = ['@echo off'];
        if (t.stdout) lines.push(`echo ${t.stdout}`);
        if (t.stderr) lines.push(`echo ${t.stderr} 1>&2`);
        lines.push(`exit /b ${t.code || 0}`);
        fs.writeFileSync(path.join(dir, `${name}.cmd`), lines.join('\r\n') + '\r\n');
      } else {
        const lines = ['#!/bin/sh'];
        if (t.stdout) lines.push(`echo '${t.stdout}'`);
        if (t.stderr) lines.push(`echo '${t.stderr}' 1>&2`);
        lines.push(`exit ${t.code || 0}`);
        fs.writeFileSync(path.join(dir, name), lines.join('\n') + '\n', { mode: 0o755 });
      }
    }
    process.env.PATH = dir + path.delimiter + savedPath;
    body();
  } finally {
    process.env.PATH = savedPath;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('probeTool: given a shim that prints its version to stderr, when probed, then it is available with that version', () => {
  withFakeTools({ fakejavac1: { stderr: 'javac 21.0.4' } }, () => {
    equal(Validation.probeTool('fakejavac1', ['-version'], /javac\s+([\d._]+)/), { available: true, version: '21.0.4' });
  });
});
test('probeTool: given a java that cannot create its virtual machine but exits 0, when probed, then it is unavailable', () => {
  withFakeTools({ fakejava2: { stderr: 'Error: Could not create the Java Virtual Machine.' } }, () => {
    const r = Validation.probeTool('fakejava2', ['-version'], /version "?([\d._]+)/);
    equal(r.available, false);
    contains(r.reason, 'Could not create the Java Virtual Machine');
  });
});
test('probeTool: given a tool that exits non-zero after printing a version, when probed, then it is unavailable', () => {
  withFakeTools({ fakegcc3: { stdout: 'gcc 14.2.0', code: 1 } }, () => {
    equal(Validation.probeTool('fakegcc3', ['--version'], /gcc (\d+\.\d+\.\d+)/).available, false);
  });
});
test('probeTool: given a tool whose output has no version, when probed, then it is unavailable', () => {
  withFakeTools({ fakeruby4: { stdout: 'hello' } }, () => {
    contains(Validation.probeTool('fakeruby4', ['--version'], /ruby (\d+\.\d+\.\d+)/).reason, 'printed no version');
  });
});
test('probeTool: given a tool not on PATH, when probed, then it is unavailable and nothing throws', () => {
  const r = Validation.probeTool('no-such-tool-anywhere-5', ['--version'], /(\d+)/);
  equal(r.available, false);
  contains(r.reason, 'not on PATH');
});

// ---------------------------------------------------------------- harnesses end to end

// Four probe algorithms, each with two vectors keyed by key and iv: one
// correct, one wrong on its second vector, one whose iv setter throws, and
// one whose vectors carry a field the instance has nowhere to put.
const INPUT = [1, 2, 3, 4], KEY = [0x10, 0x20], IV = [0x0f];
const xorOut = data => data.map((b, i) => b ^ KEY[i % KEY.length] ^ IV[0]);
const PROBE_VECTORS = [
  { text: 'a', input: INPUT, key: KEY, iv: IV, expected: xorOut(INPUT) },
  { text: 'b', input: INPUT.slice(0, 2), key: KEY, iv: IV, expected: xorOut(INPUT.slice(0, 2)) }
];
const LACKING_VECTORS = PROBE_VECTORS.map(v => Object.assign({ counter: 7 }, v));
const PROBES = ['Good', 'Wrong', 'Throwing', 'Lacking'];
const PROBE_SPEC = {
  algorithms: PROBES.map(name => ({
    name, className: `${name}Algorithm`, isMode: false, multiKey: false,
    vectors: (name === 'Lacking' ? LACKING_VECTORS : PROBE_VECTORS).map(v => plan(v, true))
  }))
};
const EXPECTED_PROBE_RESULTS = [
  [2, null],
  [1, ['vector 1: output ', ' expected ']],
  [0, ['vector 0: ', "Setting vector field 'iv' failed: ", 'iv rejected']],
  [0, ['vector 0: ', "Vector field 'counter' is not applied: Lacking has no setter or property of that name"]]
];

const available = {};
function hasTool(language) {
  if (!(language in available)) available[language] = !!Validation.LANGUAGE_COMPILERS[language].detect().available;
  return available[language];
}

function runProbe(language, code) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `harness-${language}-`));
  try {
    const harness = Validation.generateTestHarness(language, code, PROBE_SPEC, 'probe');
    if (!harness.success) throw new Error(harness.error);
    const compiled = Validation.testCompilation(language, harness.code, dir);
    if (!compiled.success) throw new Error(`does not compile: ${Validation.firstError(compiled.errors, language)}`);
    return Validation.parseHarnessOutput(PROBE_SPEC, Validation.executeCode(language, dir), language);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function checkProbe(results) {
  results.forEach((r, i) => {
    const [passed, error] = EXPECTED_PROBE_RESULTS[i];
    equal(r.passed, passed, `${PROBES[i]} passed: `);
    if (error === null) equal(r.error, null, `${PROBES[i]} error: `);
    else for (const part of error) contains(r.error, part, `${PROBES[i]} error: `);
  });
}

const JS_PROBE = `
var AlgorithmFramework = { Algorithms: [] };
class ProbeInstance {
  constructor(algorithm, inverse) { this.algorithm = algorithm; this.data = []; this._key = null; this._iv = null; }
  set key(k) { this._key = k; } get key() { return this._key; }
  set iv(v) { if (this.algorithm.name === 'Throwing') throw new Error('iv rejected'); this._iv = v; } get iv() { return this._iv; }
  Feed(d) { for (const b of d) this.data.push(b); }
  Result() {
    const out = this.data.map((b, i) => b ^ this._key[i % this._key.length] ^ this._iv[0]);
    if (this.algorithm.name === 'Wrong' && out.length === 2) out[0] ^= 1;
    return out;
  }
}
for (const name of ${JSON.stringify(PROBES)}) {
  const tests = ${JSON.stringify(PROBE_VECTORS)};
  AlgorithmFramework.Algorithms.push({ name, tests: name === 'Lacking' ? tests.map(t => Object.assign({ counter: 7 }, t)) : tests,
    CreateInstance(inverse) { return new ProbeInstance(this, inverse); } });
}
`;

test('JavaScript harness: given a wrong vector, a throwing setter and an unapplied field, when run, then each is reported, none swallowed', () => {
  if (!hasTool('javascript')) return 'skip';
  checkProbe(runProbe('javascript', JS_PROBE));
});

const TS_PROBE = `
declare const console: { log(...data: any[]): void };
var AlgorithmFramework: any = { Algorithms: [] };
class ProbeInstance {
  algorithm: any; data: number[] = []; _key: number[] = null; _iv: number[] = null;
  constructor(algorithm: any, inverse: boolean) { this.algorithm = algorithm; }
  set key(k: number[]) { this._key = k; } get key(): number[] { return this._key; }
  set iv(v: number[]) { if (this.algorithm.name === 'Throwing') throw new Error('iv rejected'); this._iv = v; } get iv(): number[] { return this._iv; }
  Feed(d: number[]): void { for (const b of d) this.data.push(b); }
  Result(): number[] {
    const out = this.data.map((b, i) => b ^ this._key[i % this._key.length] ^ this._iv[0]);
    if (this.algorithm.name === 'Wrong' && out.length === 2) out[0] ^= 1;
    return out;
  }
}
for (const name of ${JSON.stringify(PROBES)}) {
  const tests: any[] = ${JSON.stringify(PROBE_VECTORS)};
  AlgorithmFramework.Algorithms.push({ name, tests: name === 'Lacking' ? tests.map(t => Object.assign({ counter: 7 }, t)) : tests,
    CreateInstance(inverse: boolean) { return new ProbeInstance(this, inverse); } });
}
`;

test('TypeScript harness: given a wrong vector, a throwing setter and an unapplied field, when compiled and run, then each is reported, none swallowed', () => {
  if (!hasTool('typescript')) return 'skip';
  checkProbe(runProbe('typescript', TS_PROBE));
});

// PHP: the probe runs on the JavaScript-semantics runtime the transpiled code carries
const phpArray = list => `new \\JS\\JsArray([${list.join(', ')}])`;
const phpVector = (v, extra) => `\\JS\\obj(['text' => '${v.text}', 'input' => ${phpArray(v.input)}, 'key' => ${phpArray(v.key)}, 'iv' => ${phpArray(v.iv)}, 'expected' => ${phpArray(v.expected)}${extra}])`;
const PHP_PROBE = () => '<?php\n'
  + fs.readFileSync(path.join(__dirname, '..', 'codingplugins', 'php-runtime.php'), 'utf-8')
    .replace(/^<\?php\s*/, '').replace(/^namespace JS;\s*$/m, 'namespace JS {') + '\n}\n'
  + `namespace AlgorithmFramework { final class M { public static $Algorithms; } }
namespace {
#[\\AllowDynamicProperties]
class ProbeInstance implements \\ArrayAccess {
  use \\JS\\ObjectBehavior;
  public $algorithm; public $data = []; public $_key = null; public $_iv = null;
  public function __construct($algorithm) { $this->algorithm = $algorithm; }
  public function set_key($k) { $this->_key = $k->toList(); }
  public function get_key() { return $this->_key; }
  public function set_iv($v) { if ($this->algorithm->name === 'Throwing') throw new \\JS\\Error('iv rejected'); $this->_iv = $v->toList(); }
  public function get_iv() { return $this->_iv; }
  public function Feed($d) { foreach ($d->toList() as $b) $this->data[] = $b; }
  public function Result() {
    $out = [];
    foreach ($this->data as $i => $b) $out[] = $b ^ $this->_key[$i % count($this->_key)] ^ $this->_iv[0];
    if ($this->algorithm->name === 'Wrong' && count($out) === 2) $out[0] ^= 1;
    return new \\JS\\JsArray($out);
  }
}
#[\\AllowDynamicProperties]
class ProbeAlgorithm {
  public $name; public $tests;
  public function __construct($name, $tests) { $this->name = $name; $this->tests = $tests; }
  public function CreateInstance($inverse = false) { return new ProbeInstance($this); }
}
\\AlgorithmFramework\\M::$Algorithms = new \\JS\\JsArray([${PROBES.map(name => `new ProbeAlgorithm('${name}', new \\JS\\JsArray([${PROBE_VECTORS.map(v => phpVector(v, name === 'Lacking' ? ", 'counter' => 7" : '')).join(', ')}]))`).join(', ')}]);
}
`;

test('PHP harness: given a wrong vector, a throwing setter and an unapplied field, when run, then each is reported, none swallowed', () => {
  if (!hasTool('php')) return 'skip';
  checkProbe(runProbe('php', PHP_PROBE()));
});

const PY_PROBE = `
_algorithms_by_name = {}
class ProbeInstance:
    def __init__(self, algorithm, inverse=False):
        self.algorithm = algorithm
        self.data = []
        self._key = None
        self._iv = None
    @property
    def key(self): return self._key
    @key.setter
    def key(self, v): self._key = list(v)
    @property
    def iv(self): return self._iv
    @iv.setter
    def iv(self, v):
        if self.algorithm.name == "Throwing": raise ValueError("iv rejected")
        self._iv = list(v)
    def feed(self, d): self.data.extend(d)
    def result(self):
        out = [b ^ self._key[i % len(self._key)] ^ self._iv[0] for i, b in enumerate(self.data)]
        if self.algorithm.name == "Wrong" and len(out) == 2: out[0] ^= 1
        return out
class ProbeAlgorithm:
    def __init__(self, name, tests):
        self.name = name
        self.tests = tests
    def create_instance(self, inverse=False): return ProbeInstance(self, inverse)
for _name in ${JSON.stringify(PROBES)}:
    _tests = [dict(t) for t in ${JSON.stringify(PROBE_VECTORS)}]
    if _name == "Lacking":
        for _t in _tests: _t["counter"] = 7
    _algorithms_by_name[_name] = ProbeAlgorithm(_name, _tests)
`;

test('Python harness: given a wrong vector, a throwing setter and an unapplied field, when run, then each is reported, none swallowed', () => {
  if (!hasTool('python')) return 'skip';
  checkProbe(runProbe('python', PY_PROBE));
});

const perlList = list => `[${list.join(', ')}]`;
const PERL_PROBE = `
our @_registered_algorithms;
package ProbeInstance;
sub new { my ($class, $algorithm) = @_; return bless { algorithm => $algorithm, data => [], _key => undef, _iv => undef }, $class; }
sub key { my $self = shift; $self->{_key} = shift if @_; return $self->{_key}; }
sub iv { my $self = shift; if (@_) { die "iv rejected\\n" if $self->{algorithm}->{name} eq 'Throwing'; $self->{_iv} = shift; } return $self->{_iv}; }
sub Feed { my ($self, $d) = @_; push @{$self->{data}}, @$d; }
sub Result {
    my ($self) = @_;
    my @k = @{$self->{_key}};
    my @out = map { $self->{data}->[$_] ^ $k[$_ % scalar(@k)] ^ $self->{_iv}->[0] } 0 .. $#{$self->{data}};
    $out[0] ^= 1 if $self->{algorithm}->{name} eq 'Wrong' && scalar(@out) == 2;
    return \\@out;
}
package ProbeAlgorithm;
sub new { my ($class, $name, $tests) = @_; return bless { name => $name, tests => $tests }, $class; }
sub CreateInstance { my ($self) = @_; return ProbeInstance->new($self); }
package main;
for my $name (${PROBES.map(n => `'${n}'`).join(', ')}) {
    my @tests = (
        { text => 'a', input => ${perlList(INPUT)}, key => ${perlList(KEY)}, iv => ${perlList(IV)}, expected => ${perlList(xorOut(INPUT))} },
        { text => 'b', input => ${perlList(INPUT.slice(0, 2))}, key => ${perlList(KEY)}, iv => ${perlList(IV)}, expected => ${perlList(xorOut(INPUT.slice(0, 2)))} }
    );
    if ($name eq 'Lacking') { $_->{counter} = 7 for @tests; }
    push @_registered_algorithms, ProbeAlgorithm->new($name, \\@tests);
}
`;

test('Perl harness: given a wrong vector, a throwing setter and an unapplied field, when run, then each is reported, none swallowed', () => {
  if (!hasTool('perl')) return 'skip';
  checkProbe(runProbe('perl', PERL_PROBE));
});

// The C# stand-in mimics the generated code's shape: framework stub classes
// named as in AlgorithmFramework.js (the stub instance declares IV and Nonce,
// as csharp.js's does) and algorithm classes nested in a *Generated class,
// whose instance declares its own Iv - the setter the JavaScript `iv` maps to.
const csBytes = list => `new byte[] { ${list.join(', ')} }`;
const csVector = (v, extra = '') => `new TestCase { Input = ${csBytes(v.input)}, Key = ${csBytes(v.key)}, Iv = ${csBytes(v.iv)}, Expected = ${csBytes(v.expected)}${extra} }`;
const CS_PROBE = `using System;
using System.Collections.Generic;
namespace CipherValidation
{
    public class TestCase
    {
        public byte[] Input { get; set; }
        public byte[] Expected { get; set; }
        public object Key { get; set; }
        public object Iv { get; set; }
        private readonly Dictionary<string, object> extra = new Dictionary<string, object>();
        public object this[string key] { get => extra.TryGetValue(key, out var v) ? v : null; set => extra[key] = value; }
    }
    public class Algorithm
    {
        public string Name { get; set; }
        public TestCase[] Tests { get; set; }
        public virtual object CreateInstance(bool isInverse = false) { return null; }
    }
    public abstract class IAlgorithmInstance
    {
        public byte[] IV { get; set; }
        public byte[] Nonce { get; set; }
        public virtual void Feed(byte[] data) { }
        public virtual byte[] Result() { return Array.Empty<byte>(); }
    }
    public class ProbeGenerated
    {
        public class ProbeInstance : IAlgorithmInstance
        {
            private readonly string name;
            private readonly List<byte> data = new List<byte>();
            private byte[] key, iv;
            public ProbeInstance(string name) { this.name = name; }
            public byte[] Key { get => key; set => key = value; }
            public byte[] Iv { get => iv; set { if (name == "Throwing") throw new ArgumentException("iv rejected"); iv = value; } }
            public override void Feed(byte[] d) { data.AddRange(d); }
            public override byte[] Result()
            {
                var output = new byte[data.Count];
                for (int i = 0; i < output.Length; ++i) output[i] = (byte)(data[i] ^ key[i % key.Length] ^ iv[0]);
                if (name == "Wrong" && output.Length == 2) output[0] ^= 1;
                return output;
            }
        }
        public class ProbeAlgorithm : Algorithm
        {
            public ProbeAlgorithm(string name, TestCase[] tests) { Name = name; Tests = tests; }
            public override object CreateInstance(bool isInverse = false) { return new ProbeInstance(Name); }
        }
        private static TestCase[] Vectors(string extra)
        {
            var tests = new[] { ${PROBE_VECTORS.map(v => csVector(v)).join(', ')} };
            foreach (var t in tests)
            {
                if (extra == "counter") t["counter"] = 7;
                if (extra == "nonce") t["nonce"] = new byte[] { 1 };
            }
            return tests;
        }
        public static readonly Algorithm Good = new ProbeAlgorithm("Good", Vectors(null));
        public static readonly Algorithm Wrong = new ProbeAlgorithm("Wrong", Vectors(null));
        public static readonly Algorithm Throwing = new ProbeAlgorithm("Throwing", Vectors(null));
        public static readonly Algorithm Lacking = new ProbeAlgorithm("Lacking", Vectors("counter"));
        public static readonly Algorithm StubOnly = new ProbeAlgorithm("StubOnly", Vectors("nonce"));
    }
}
`;

// One build covers the C# cases: the four probes, and a fifth whose vectors
// carry a nonce that only the framework stub declares.
const CS_SPEC = { algorithms: PROBE_SPEC.algorithms.concat([{ name: 'StubOnly', className: 'ProbeAlgorithm', isMode: false, multiKey: false,
  vectors: PROBE_VECTORS.map(v => plan(Object.assign({ nonce: [1] }, v), null)) }]) };
let csResults = null;
function csharpProbe() {
  if (csResults) return csResults;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-csharp-'));
  try {
    const harness = Validation.generateTestHarness('csharp', CS_PROBE, CS_SPEC, 'probe');
    const compiled = Validation.testCompilation('csharp', harness.code, dir);
    if (!compiled.success) throw new Error(`does not compile: ${Validation.firstError(compiled.errors, 'csharp')}`);
    csResults = Validation.parseHarnessOutput(CS_SPEC, Validation.executeCode('csharp', dir), 'csharp');
    return csResults;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const noDotnet = () => !hasTool('csharp') || (cases.options && cases.options.dotnet === false);

test('C# harness: given the IV the JavaScript names iv, a wrong vector, a throwing setter and an unapplied field, when run, then Iv is set and each failure reported', () => {
  if (noDotnet()) return 'skip';
  checkProbe(csharpProbe().slice(0, PROBES.length));
});

test('C# harness: given a vector field only a framework stub declares, when run, then it is not applied and the stub is named', () => {
  if (noDotnet()) return 'skip';
  const r = csharpProbe()[PROBES.length];
  contains(r.error, "Vector field 'nonce' is not applied");
  contains(r.error, 'only the framework stub IAlgorithmInstance.Nonce declares one');
});

/**
 * HARNESS: run every validation harness case.
 * @param {object} options - { verbose, dotnet }
 * @returns {Promise<object>} { passed, failed, skipped, detail }
 */
function run(options = {}) {
  console.log('Cross-language validation harness tests');
  cases.options = options;
  return cases.runAsync(options);
}

module.exports = { run };
