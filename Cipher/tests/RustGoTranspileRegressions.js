/**
 * RustGoTranspileRegressions.js - regression tests for systematic Go and Rust
 * transpilation faults (each case names the fault it pins down).
 *
 * Every case is Given (a JavaScript snippet) / When (transpiled to Go and to
 * Rust, the AlgorithmFramework base classes included) / Then (a driver calling
 * the transpiled code prints the values JavaScript prints). All cases of a
 * language are bundled into one program - each snippet transpiled as a
 * library under a prefix of its own - so each language compiles once. A
 * language whose toolchain is not installed is skipped.
 *
 * The RUSTGO category: node tests/TranspilerSuite.js --only=rustgo [--verbose]
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const CIPHER_DIR = path.join(__dirname, '..');
let verbose = false;

const realLog = console.log;
const quiet = fn => { console.log = () => {}; try { return fn(); } finally { console.log = realLog; } };

const { TypeAwareJSASTParser } = quiet(() => require(path.join(CIPHER_DIR, 'type-aware-transpiler.js')));
const { GoTransformer } = require(path.join(CIPHER_DIR, 'codingplugins', 'GoTransformer.js'));
const { GoEmitter } = require(path.join(CIPHER_DIR, 'codingplugins', 'GoEmitter.js'));
const { RustTransformer } = require(path.join(CIPHER_DIR, 'codingplugins', 'RustTransformer.js'));
const { RustEmitter } = require(path.join(CIPHER_DIR, 'codingplugins', 'RustEmitter.js'));

/**
 * The cases. `go` and `rust` are the driver bodies; every top-level name of
 * the snippet carries the prefix PFX (replaced by the case's own prefix).
 */
const CASES = [
  {
    name: 'framework: an inherited Result reaches the class\'s own EncryptBlock',
    // Given a block cipher instance that defines only EncryptBlock/DecryptBlock
    js: 'class Inc extends AlgorithmFramework.IBlockCipherInstance {\n' +
      '  constructor(isInverse) { super(null); this.isInverse = isInverse; this.BlockSize = 2; }\n' +
      '  EncryptBlock(block) { return [block[0] + 1, block[1] + 1]; }\n' +
      '  DecryptBlock(block) { return [block[0] - 1, block[1] - 1]; }\n' +
      '}\n' +
      '/** @returns {uint8[]} */\nfunction run() { const e = new Inc(false); e.key = [0]; e.Feed([1, 2, 3, 4]); return e.Result(); }',
    // When the framework's Result runs over two blocks
    go: 'fmt.Println(PFXrun())',
    rust: 'println!("{:?}", PFXrun().to_vec());',
    // Then each block went through the class's EncryptBlock
    expect: { go: '[2 3 4 5]', rust: '[2, 3, 4, 5]' }
  },
  {
    name: 'numbers: 32-bit operators follow ToInt32/ToUint32, sums are truncated by >>> 0',
    // Given values at the 32-bit boundary
    js: '/** @param {uint32} a @param {uint32} b @returns {uint32[]} */\n' +
      'function ops(a, b) { return [(a + b) >>> 0, (a << 24) >>> 0, (~a) >>> 0, (a >> 31) >>> 0, Math.imul(a, b) >>> 0]; }',
    // When added, shifted, inverted and multiplied
    go: 'fmt.Println(PFXops(0xFFFFFFFF, 2))',
    rust: 'println!("{:?}", PFXops(0xFFFFFFFFu32, 2u32).to_vec());',
    // Then the results equal JavaScript's
    expect: { go: '[1 4278190080 0 4294967295 4294967294]', rust: '[1, 4278190080, 0, 4294967295, 4294967294]' }
  },
  {
    name: 'bigint: 64-bit operators keep full width; a rotation past 63 bits stays in range',
    // Given BigInt values with the top bit set
    js: '/** @param {bigint} x @returns {string} */\n' +
      'function rot(x) { const m = 0xFFFFFFFFFFFFFFFFn; const r = ((x << 8n) | (x >> 56n)) & m; return (r ^ 0x8000000000000000n).toString(16); }',
    // When rotated left by 8 within 64 bits and xored
    go: 'fmt.Println(PFXrot(jsBigLit("18446744073709551360")))',
    rust: 'println!("{}", PFXrot(js_big_lit("18446744073709551360")));',
    // Then the hex value equals JavaScript's
    expect: { go: '7fffffffffff00ff', rust: '7fffffffffff00ff' }
  },
  {
    name: 'arrays: an array taken from a field aliases it',
    // Given a class whose method writes through a local alias of its state array
    js: 'class S { constructor() { /** @type {int32[]} */ this.state = [1, 2]; }\n' +
      '  /** @returns {int32[]} */\n  touch() { const s = this.state; s[0] = 9; return this.state; } }\n' +
      '/** @returns {int32[]} */\nfunction run() { return new S().touch(); }',
    go: 'fmt.Println(PFXrun())',
    rust: 'println!("{:?}", PFXrun().to_vec());',
    // Then the field sees the write
    expect: { go: '[9 2]', rust: '[9, 2]' }
  },
  {
    name: 'closures: a callback that changes a local of its function changes the same variable',
    // Given a forEach callback summing into a local
    js: '/** @param {uint8[]} xs @returns {int32} */\nfunction sum(xs) { let n = 0; xs.forEach(x => { n += x; }); return n; }',
    go: 'fmt.Println(PFXsum([]uint8{1, 2, 3}))',
    rust: 'println!("{}", PFXsum(js_arr(vec![1u8, 2, 3])));',
    // Then the local holds the sum after the loop
    expect: { go: '6', rust: '6' }
  },
  {
    name: 'expressions: a conditional argument of push keeps the push in place',
    // Given push(c ? a : b) inside a loop
    js: '/** @returns {int32[]} */\nfunction pick() { /** @type {int32[]} */ const out = []; for (let i = 0; i < 4; ++i) out.push(i % 2 ? i * 10 : i); return out; }',
    go: 'fmt.Println(PFXpick())',
    rust: 'println!("{:?}", PFXpick().to_vec());',
    // Then every element is pushed once, in order
    expect: { go: '[0 10 2 30]', rust: '[0, 10, 2, 30]' }
  },
  {
    name: 'exceptions: a return inside try returns; a thrown Error is caught with its message',
    // Given a function returning from inside try, and one catching its own throw
    js: '/** @param {int32} x @returns {string} */\nfunction f(x) { try { if (x > 0) return "pos"; throw new Error("neg " + x); } catch (e) { return e.message; } }',
    go: 'fmt.Println(PFXf(1), PFXf(-2))',
    rust: 'println!("{} {}", PFXf(1), PFXf(-2));',
    expect: { go: 'pos neg -2', rust: 'pos neg -2' }
  },
  {
    name: 'switch: cases without break fall through; default may stand between cases',
    // Given a switch with a fall-through case and a default in the middle
    js: '/** @param {int32} x @returns {string} */\nfunction f(x) { let s = ""; switch (x) { case 1: s += "a"; case 2: s += "b"; break; default: s += "d"; case 3: s += "c"; } return s; }',
    go: 'fmt.Println(PFXf(1), PFXf(2), PFXf(3), PFXf(9))',
    rust: 'println!("{} {} {} {}", PFXf(1), PFXf(2), PFXf(3), PFXf(9));',
    expect: { go: 'ab b c dc', rust: 'ab b c dc' }
  },
  {
    name: 'logical: a || b of numbers yields an operand, not a boolean',
    js: '/** @param {int32} size @returns {int32} */\nfunction f(size) { const n = size || 16; return n * 2; }',
    go: 'fmt.Println(PFXf(0), PFXf(5))',
    rust: 'println!("{} {}", PFXf(0), PFXf(5));',
    expect: { go: '32 10', rust: '32 10' }
  },
  {
    name: 'loops: labeled continue reaches the outer loop; the update still runs',
    js: '/** @returns {int32} */\nfunction f() { let n = 0; outer: for (let i = 0; i < 3; ++i) { for (let j = 0; j < 3; ++j) { if (j === 1) continue outer; n += 10 * i + j; } } return n; }',
    go: 'fmt.Println(PFXf())',
    rust: 'println!("{}", PFXf());',
    expect: { go: '30', rust: '30' }
  },
  {
    name: 'strings: char codes, String.fromCharCode.apply, padStart and toString(16)',
    js: '/** @param {string} s @returns {string} */\nfunction f(s) { /** @type {int32[]} */ const codes = []; for (let i = 0; i < s.length; ++i) codes.push(s.charCodeAt(i) + 1);\n' +
      '  return String.fromCharCode.apply(null, codes) + ":" + (255).toString(16).padStart(4, "0"); }',
    go: 'fmt.Println(PFXf("HAL"))',
    rust: 'println!("{}", PFXf("HAL".to_string()));',
    expect: { go: 'IBM:00ff', rust: 'IBM:00ff' }
  },
  {
    name: 'regex: global replace with a negated class, split on whitespace runs',
    js: '/** @param {string} s @returns {string} */\nfunction f(s) { return s.toUpperCase().replace(/[^A-Z]/g, "") + "|" + "a  b c".split(/\\s+/).length; }',
    go: 'fmt.Println(PFXf("Hello, World 42"))',
    rust: 'println!("{}", PFXf("Hello, World 42".to_string()));',
    expect: { go: 'HELLOWORLD|3', rust: 'HELLOWORLD|3' }
  },
  {
    name: 'generics: a @template return keeps the value the callback returned',
    // Given the framework BlockAbsorber whose Finish returns what its finalizer returns (@template T)
    js: '/** @returns {uint8[]} */\nfunction f() { const a = new AlgorithmFramework.BlockAbsorber(4, block => {});\n' +
      '  a.Absorb([1, 2, 3]); return a.Finish((held, pending, total) => held.slice(0, pending)); }',
    go: 'fmt.Println(PFXf())',
    rust: 'println!("{:?}", PFXf().to_vec());',
    expect: { go: '[1 2 3]', rust: '[1, 2, 3]' }
  },
  {
    name: 'statics: a static field and method are shared by the class',
    js: 'class C { static twice(x) { return 2 * x; } }\nC.base = 20;\n/** @returns {int32} */\nfunction f() { return C.twice(C.base) + 1; }',
    go: 'fmt.Println(PFXf())',
    rust: 'println!("{}", PFXf());',
    expect: { go: '41', rust: '41' }
  },
  {
    name: 'classes: super.m() of a base without m throws the TypeError JavaScript throws',
    // Given a derived class calling a base method no base class has
    js: 'class B { constructor() { /** @type {int32} */ this.n = 0; } }\n' +
      'class D extends B { clear() { super.clear(); this.n = 1; } }\n' +
      '/** @returns {string} */\nfunction f() { const d = new D(); try { d.clear(); return "no throw"; } catch (e) { return e.message + " " + d.n; } }',
    go: 'fmt.Println(PFXf())',
    rust: 'println!("{}", PFXf());',
    // Then the call throws before the rest of the method runs
    expect: { go: '(intermediate value).clear is not a function 0', rust: '(intermediate value).clear is not a function 0' }
  }
];

/** IL of a snippet. */
function parse(js) {
  return quiet(() => new TypeAwareJSASTParser(js).parse());
}

function prefixed(text, prefix) { return text.replace(/PFX/g, prefix); }

/** The Go program: the runtime once, each case as a prefixed library, and a main running every driver. */
function goProgram() {
  const runtime = new GoEmitter({}).emit(new GoTransformer({}).transform(parse('')));
  const parts = [runtime];
  const calls = [];
  CASES.forEach((c, i) => {
    const prefix = `c${i}_`;
    const file = new GoTransformer({ library: true, symbolPrefix: prefix }).transform(parse(c.js));
    const emitter = new GoEmitter({});
    parts.push(file.decls.map(d => emitter.decl(d)).join('\n'));
    parts.push(`func case${i}() {\n\tdefer func() {\n\t\tif r := recover(); r != nil {\n\t\t\tfmt.Println("PANIC", r)\n\t\t}\n\t}()\n\t${prefixed(c.go, prefix)}\n}`);
    calls.push(`\tfmt.Println("@@${i}")\n\tcase${i}()`);
  });
  parts.push(`func main() {\n${calls.join('\n')}\n}`);
  return parts.join('\n\n');
}

/** The Rust program: the runtime once, each case as a prefixed library, and a main running every driver. */
function rustProgram() {
  const runtime = new RustEmitter({}).emit(new RustTransformer({}).transform(parse('')));
  const parts = [runtime];
  const calls = [];
  CASES.forEach((c, i) => {
    const prefix = `c${i}_`;
    parts.push(new RustEmitter({}).emit(new RustTransformer({ library: true, symbolPrefix: prefix }).transform(parse(c.js))));
    parts.push(`fn case${i}() {\n    ${prefix}js_module_init();\n    ${prefixed(c.rust, prefix)}\n}`);
    calls.push(`    println!("@@${i}");\n    if std::panic::catch_unwind(case${i}).is_err() { println!("PANIC"); }`);
  });
  parts.push(`fn main() {\n    std::panic::set_hook(Box::new(|_| {}));\n    js_module_init();\n${calls.join('\n')}\n}`);
  return parts.join('\n\n');
}

function toolAvailable(command, args) {
  const probe = spawnSync(command, args, { encoding: 'utf-8', windowsHide: true });
  return probe.status === 0;
}

/**
 * Compile and run one language's program.
 * @returns {Map<number, string>|string} case index -> output, or 'skip' / an error message
 */
function runLanguage(language) {
  const exe = process.platform === 'win32' ? 'probe.exe' : 'probe';
  if (language === 'go' && !toolAvailable('go', ['version'])) return 'skip';
  if (language === 'rust' && !toolAvailable('rustc', ['--version'])) return 'skip';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${language}-regression-`));
  try {
    let build;
    if (language === 'go') {
      fs.writeFileSync(path.join(dir, 'go.mod'), 'module probe\n\ngo 1.21\n');
      fs.writeFileSync(path.join(dir, 'main.go'), goProgram());
      build = spawnSync('go', ['build', '-buildvcs=false', '-o', exe, '.'], { cwd: dir, encoding: 'utf-8', timeout: 600000, windowsHide: true });
    } else {
      fs.writeFileSync(path.join(dir, 'main.rs'), rustProgram());
      build = spawnSync('rustc', ['-A', 'warnings', '-C', 'overflow-checks=on', 'main.rs', '-o', exe], { cwd: dir, encoding: 'utf-8', timeout: 600000, windowsHide: true });
    }
    if (build.status !== 0) return `${language} build failed: ${((build.stderr || '') + (build.stdout || '')).split('\n').slice(0, 12).join('\n')}`;
    const run = spawnSync(path.join(dir, exe), [], { cwd: dir, encoding: 'utf-8', timeout: 120000, windowsHide: true });
    const out = new Map();
    let current = -1;
    for (const line of String(run.stdout || '').replace(/\r/g, '').split('\n')) {
      const m = /^@@(\d+)$/.exec(line);
      if (m) { current = Number(m[1]); out.set(current, []); continue; }
      if (current >= 0 && line) out.get(current).push(line);
    }
    return new Map([...out].map(([k, v]) => [k, v.join('\n')]));
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* temp dir cleanup is best effort */ }
  }
}

const cases = require('./UnitCases.js').createCases();
const results = {};
function outputOf(language, i) {
  if (!(language in results)) results[language] = quiet(() => runLanguage(language));
  const r = results[language];
  if (r === 'skip') return 'skip';
  if (typeof r === 'string') throw new Error(r);
  return r.has(i) ? r.get(i) : '(no output)';
}

CASES.forEach((c, i) => {
  for (const language of ['go', 'rust']) {
    cases.case(`${language}: ${c.name}`, () => {
      const out = outputOf(language, i);
      if (out === 'skip') return 'skip';
      if (out !== c.expect[language]) throw new Error(`expected ${c.expect[language]}, got ${out}`);
    });
  }
});

/**
 * RUSTGO: run every regression case.
 * @param {object} options - { verbose }
 * @returns {object} { passed, failed, skipped, detail }
 */
function run(options = {}) {
  verbose = Boolean(options.verbose);
  realLog('Go and Rust transpile regression suite');
  return cases.run({ verbose });
}

module.exports = { run, goProgram, rustProgram, CASES };
