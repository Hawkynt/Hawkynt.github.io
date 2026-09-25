#!/usr/bin/env node
/**
 * CSharpTranspileRegressionSuite.js - regression tests for systematic C#
 * transpilation faults (each case names the fault it pins down).
 *
 * Every case is Given (a JavaScript snippet) / When (transpiled to C#) / Then
 * (the generated code has, or lacks, a specific shape). The runtime-stub cases
 * additionally compile and run a small C# program against the generated
 * framework stubs when the .NET SDK is installed; they are skipped otherwise.
 *
 * Usage: node tests/CSharpTranspileRegressionSuite.js [--verbose] [--no-dotnet]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const CIPHER_DIR = path.join(__dirname, '..');
const verbose = process.argv.includes('--verbose');
const allowDotnet = !process.argv.includes('--no-dotnet');

// The transpiler logs progress on console.log; keep the suite output readable.
const realLog = console.log;
const quiet = fn => { console.log = () => {}; try { return fn(); } finally { console.log = realLog; } };

const { TypeAwareJSASTParser } = quiet(() => require(path.join(CIPHER_DIR, 'type-aware-transpiler.js')));
const { LanguagePlugins } = require(path.join(CIPHER_DIR, 'codingplugins', 'LanguagePlugin.js'));
quiet(() => require(path.join(CIPHER_DIR, 'codingplugins', 'csharp.js')));
const plugin = LanguagePlugins.GetAll().find(p => /c#|csharp/i.test(p.name || '') || p.extension === 'cs');

function transpile(js, withStubs = false) {
  return quiet(() => {
    const ast = new TypeAwareJSASTParser(js).parse();
    const result = plugin.GenerateFromAST(ast, {
      namespace: 'RegressionTest', className: 'Generated',
      generateTestHarness: false, generateFrameworkStubs: withStubs
    });
    if (!result.success) throw new Error(result.error || 'transpile failed');
    return result.code;
  });
}

let passed = 0, failed = 0, skipped = 0;
function check(name, fn) {
  try {
    const outcome = fn();
    if (outcome === 'skip') { ++skipped; realLog(`  - ${name} (skipped)`); return; }
    ++passed;
    if (verbose) realLog(`  ✓ ${name}`);
  } catch (e) {
    ++failed;
    realLog(`  ✗ ${name}\n      ${e.message.split('\n').join('\n      ')}`);
  }
}
function expectMatch(code, re, what) {
  if (!re.test(code)) throw new Error(`expected ${what} (${re})\n${verbose ? code : ''}`);
}
function expectNoMatch(code, re, what) {
  if (re.test(code)) throw new Error(`did not expect ${what} (${re})\n${verbose ? code : ''}`);
}

realLog('C# transpile regression suite');

// ---------------------------------------------------------------------------
// Parser: contextual keywords are ordinary identifiers
// ---------------------------------------------------------------------------
check('parser: `set` as a const name and a for..of binding', () => {
  const ast = quiet(() => new TypeAwareJSASTParser(
    'function f(sets) { const set = { a: 1 }; let n = set.a; for (const set of sets) n += set; return n; }').parse());
  if (!ast || ast.type !== 'Program') throw new Error('no Program node');
});
check('parser: `get`, `of`, `static`, `async`, `as` as parameter and variable names', () => {
  quiet(() => new TypeAwareJSASTParser(
    'function f(get, of) { const as = get + of; let async = as; const static = async; return static; }').parse());
});
check('parser: class getters/setters still parse as accessors', () => {
  const code = transpile('class A { get size() { return this._s; } set size(v) { this._s = v; } }');
  expectMatch(code, /\bSize\b[\s\S]*\bget\b[\s\S]*\bset\b/, 'a Size property with get and set');
});

// ---------------------------------------------------------------------------
// Module-level bindings are hoisted as PascalCase members
// ---------------------------------------------------------------------------
check('module binding: camelCase const table and arrow helper are referenced by their hoisted names', () => {
  const code = transpile('const sboxTable = [1, 2, 3];\nconst rol = (v, n) => v + n;\nfunction use(i) { return rol(sboxTable[i], 1); }');
  expectMatch(code, /Rol\(SboxTable\[/, 'Rol(SboxTable[...])');
  expectNoMatch(code, /\bsboxTable\b|\brol\(/, 'a camelCase reference');
});
check('module binding: IIFE locals are referenced by their hoisted names', () => {
  const code = transpile('const T = (function () { const phiN = (w) => w + 1; const mix = (x) => phiN(x); return { mix }; })();');
  expectMatch(code, /PhiN\(x/, 'PhiN(x) inside the hoisted Mix');
});
check('module binding: a same-named parameter shadows the module binding (function, arrow, method)', () => {
  const code = transpile('const table = [1, 2];\nconst apply = (table) => table[0];\nfunction g(table) { return table[1]; }\nclass K { run(table) { return table[0]; } }');
  expectNoMatch(code, /Table\[0\] *;|Table\[1\]/, 'a parameter rewritten to the module field');
  expectMatch(code, /table => table\[0\]/, 'the arrow keeps its own parameter');
});

check('IIFE hoisting: two IIFEs with the same local get distinct module names; a shadowing parameter is kept', () => {
  const code = transpile('const A = (() => { const table = [1, 2]; return table; })();\nconst B = (() => { const table = [3, 4]; const f = (table) => table[0]; return f(table); })();');
  expectMatch(code, /\bTable\b[^;]*=/, 'the first hoisted Table');
  expectMatch(code, /\bTable_2\b[^;]*=/, 'the second, renamed Table_2');
  expectMatch(code, /table => table\[0\]/, 'the arrow parameter untouched');
  expectMatch(code, /F\(Table_2\)/, 'the second IIFE reading its own renamed local');
});

// ---------------------------------------------------------------------------
// Locals that camelCase onto a parameter name
// ---------------------------------------------------------------------------
check('scope: `const A = a` next to parameter `a` gets a distinct C# name', () => {
  const code = transpile('function mul(a, b) { const A = a === 0 ? 65536 : a; return A * b; }');
  expectMatch(code, /\ba2\s*=.*\ba\b/, 'a renamed local a2 initialised from a');
  expectMatch(code, /return a2 \*/, 'the renamed local used afterwards');
});
check('scope: loop variable `r` next to parameter `R` does not redeclare it', () => {
  const code = transpile('function f(L, R) { let s = 0; for (let r = 0; r < 8; r++) s += r + R; return s + L; }');
  expectMatch(code, /for \(int r2 = 0; r2 < 8; r2\+\+\)/, 'the loop variable renamed to r2');
  expectMatch(code, /r2 \+ r\b/, 'the loop body reading both r2 and the parameter r');
});

// ---------------------------------------------------------------------------
// Field typing
// ---------------------------------------------------------------------------
check('fields: null-initialised then constructed field takes the class type', () => {
  const code = transpile('class H { constructor() { this._absorber = null; } set key(k) { this._absorber = new BlockAbsorber(64, b => this._p(b)); } _p(b) {} }');
  expectMatch(code, /BlockAbsorber\??\s+_absorber/, 'a BlockAbsorber-typed _absorber');
});
check('fields: object literal assigned behind accessors is dynamic, not byte[]', () => {
  const code = transpile('class R { constructor() { this._publicKey = null; } set publicKey(k) { this._publicKey = k ? k : null; } get publicKey() { return this._publicKey; } gen(n) { this._publicKey = { n: n }; return this._publicKey.n; } }');
  expectMatch(code, /dynamic\??\s+_publicKey/, 'a dynamic _publicKey');
  expectNoMatch(code, /byte\[\]\??\s+_publicKey/, 'a byte[] _publicKey');
});
check('destructuring: object pattern over a scalar-guessed source is held as dynamic', () => {
  const code = transpile('class C { constructor() { this._sched = 0; } run() { const { RK, W } = this._sched; return RK[0] + W[0]; } }');
  expectMatch(code, /dynamic _destructure_\d+ = this\._sched/, 'a dynamic destructuring temp');
});

// ---------------------------------------------------------------------------
// Expression mappings
// ---------------------------------------------------------------------------
check('bigint.toString(radix) uses the ToRadixString helper', () => {
  const code = transpile('function f(q) { const x = BigInt(q) * 3n; return x.toString(2).length; }');
  expectMatch(code, /ToRadixString\(x, 2\)/, 'ToRadixString(x, 2)');
});
check('number.toString(2) still uses Convert.ToString', () => {
  const code = transpile('function f(q) { const n = q | 0; return n.toString(2); }');
  expectMatch(code, /Convert\.ToString\(/, 'Convert.ToString(...)');
});
check('crypto.getRandomValues maps to GetRandomValues and the feature test folds to true', () => {
  const code = transpile('function r(n) { const b = new Uint8Array(n); if (typeof crypto !== "undefined" && crypto.getRandomValues) { crypto.getRandomValues(b); } return b; }');
  expectMatch(code, /GetRandomValues\(b\)/, 'GetRandomValues(b)');
  expectNoMatch(code, /crypto\./, 'a crypto.* member access');
});
check('record.table[i]: the index parameter is an integer, not a string key', () => {
  const code = transpile('class C { f(tabs, round, x) { return x ^ tabs.P16[round]; } g(t) { return this.f(t, 3, 5); } }');
  expectNoMatch(code, /string round/, 'a string-typed round parameter');
});
check('inputBuffer.push(array) appends the bytes (Concat); other arrays keep push-as-element (Append)', () => {
  const code = transpile('class I { constructor() { this.inputBuffer = []; this.rows = []; } Feed(data) { this.inputBuffer.push(data); } add(row) { this.rows.push(row); } }');
  expectMatch(code, /InputBuffer\.Concat\(data\)/, 'InputBuffer.Concat(data)');
  expectNoMatch(code, /Rows\.Concat\(/, 'Rows.Concat(...)');
});
check('dynamic truthiness uses IsTruthy', () => {
  const code = transpile('class K { constructor() { this._k = null; } gen() { this._k = { n: 1 }; } has() { return !this._k; } }');
  expectMatch(code, /!IsTruthy\(this\._k\)/, '!IsTruthy(this._k)');
});
check('runtime-keyed tables: empty `{}` and non-uniform rows become Dictionary<string, dynamic>', () => {
  const code = transpile('const SETS = {};\nconst CURVES = { a: { p: 1, sub: { q: 2 } }, b: 7 };\nfunction get(name) { return SETS[name] || CURVES[name]; }');
  expectMatch(code, /Dictionary<string, dynamic> SETS/, 'SETS as Dictionary<string, dynamic>');
  expectMatch(code, /Dictionary<string, dynamic> CURVES/, 'CURVES as Dictionary<string, dynamic>');
});
check('runtime-keyed tables: numeric key into a string-keyed dictionary is converted with ToString', () => {
  const code = transpile('const KEYS = { 512: { p: "a" }, 1024: { p: "b" } };\nfunction get(size) { const s = size | 0; return KEYS[s].p; }');
  expectMatch(code, /KEYS\[s\.ToString\(\)\]/, 'KEYS[s.ToString()]');
});

// ---------------------------------------------------------------------------
// Runtime stubs (needs the .NET SDK)
// ---------------------------------------------------------------------------
check('runtime stubs: BlockAbsorber, pad helpers, ToRadixString, IsTruthy, GFMul behave like the JS framework', () => {
  if (!allowDotnet) return 'skip';
  const probe = spawnSync('dotnet', ['--version'], { encoding: 'utf-8' });
  if (probe.status !== 0) return 'skip';

  const stubs = transpile('function unused() { return 0; }', true)
    .replace(/public static void Main\s*\([^)]*\)\s*\{[^}]*\}/, '');
  const program = `${stubs}
namespace RegressionTest {
  public static class Probe {
    static int failures = 0;
    static void Eq(string name, object got, object want) {
      if (!object.Equals(got?.ToString(), want?.ToString())) { ++failures; Console.WriteLine("FAIL " + name + ": got " + got + " want " + want); }
    }
    static string Hex(byte[][] blocks) => string.Join("|", blocks.Select(b => Convert.ToHexString(b)));
    public static int Main() {
      // ToRadixString: zero, negative, radix 16 lower-case, radix 36 boundary
      Eq("radix0", FrameworkFunctions.ToRadixString(BigInteger.Zero, 2), "0");
      Eq("radix-neg", FrameworkFunctions.ToRadixString(new BigInteger(-10), 2), "-1010");
      Eq("radix16", FrameworkFunctions.ToRadixString(new BigInteger(255), 16), "ff");
      Eq("radix36", FrameworkFunctions.ToRadixString(new BigInteger(35), 36), "z");
      // IsTruthy: JS falsy values and objects
      Eq("t-null", FrameworkFunctions.IsTruthy(null), false);
      Eq("t-zero", FrameworkFunctions.IsTruthy(0), false);
      Eq("t-nan", FrameworkFunctions.IsTruthy(double.NaN), false);
      Eq("t-empty", FrameworkFunctions.IsTruthy(""), false);
      Eq("t-one", FrameworkFunctions.IsTruthy(1u), true);
      Eq("t-obj", FrameworkFunctions.IsTruthy(new { n = 1 }), true);
      // SpongePadBlocks: rate-1 bytes pending merges separator and final bit (0x86)
      Eq("sponge-merge", Hex(FrameworkFunctions.SpongePadBlocks(new byte[] { 1, 2, 3 }, 3, 4, 0x06)), "01020386");
      Eq("sponge-empty", Hex(FrameworkFunctions.SpongePadBlocks(new byte[0], 0, 4, 0x1F)), "1F000080");
      Eq("sponge-full", Hex(FrameworkFunctions.SpongePadBlocks(new byte[] { 1, 2, 3, 4 }, 4, 4, 0x06)), "01020304|06000080");
      // MerkleDamgardBlocks: 55 bytes fit one block, 56 need two (SHA-256 boundary)
      Eq("md-55", FrameworkFunctions.MerkleDamgardBlocks(new byte[55], 55, 55, new { BlockSize = 64, LengthBytes = 8 }).Length, 1);
      Eq("md-56", FrameworkFunctions.MerkleDamgardBlocks(new byte[56], 56, 56, new { BlockSize = 64, LengthBytes = 8 }).Length, 2);
      Eq("md-len", Convert.ToHexString(FrameworkFunctions.MerkleDamgardBlocks(new byte[0], 0, 3, new { BlockSize = 64, LengthBytes = 8 })[0].Skip(56).ToArray()), "0000000000000018");
      Eq("md-le", Convert.ToHexString(FrameworkFunctions.MerkleDamgardBlocks(new byte[0], 0, 3, new { BlockSize = 64, LengthBytes = 8, LengthLittleEndian = true })[0].Skip(56).ToArray()), "1800000000000000");
      // BlockAbsorber holds the last full block back until more data arrives
      var seen = new List<string>();
      var absorber = new BlockAbsorber(4, b => seen.Add(Convert.ToHexString(b)));
      absorber.Absorb(new byte[] { 1, 2, 3, 4 });
      Eq("hold-full", seen.Count, 0);
      absorber.Absorb(new byte[] { 5 });
      Eq("release", string.Join(",", seen), "01020304");
      Eq("tail", absorber.Finish((held, pending, total) => Convert.ToHexString(held) + "/" + pending + "/" + total), "05/1/5");
      // GFMul: AES field, 0x57 * 0x83 = 0xC1 (FIPS-197 example)
      Eq("gfmul", OpCodes.GFMul(0x57, 0x83, 0x11B, 8), 0xC1);
      Console.WriteLine(failures == 0 ? "STUBS_OK" : "STUBS_FAILED");
      return failures == 0 ? 0 : 1;
    }
  }
}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-regression-'));
  try {
    fs.writeFileSync(path.join(dir, 'Program.cs'), program);
    fs.writeFileSync(path.join(dir, 'Probe.csproj'), `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>disable</Nullable>
    <StartupObject>RegressionTest.Probe</StartupObject>
    <NoWarn>CS0168;CS0219;CS0414;CS8600;CS8601;CS8602;CS8603;CS8604;CS8618;CS8625;CS8632</NoWarn>
  </PropertyGroup>
</Project>`);
    const run = spawnSync('dotnet', ['run', '--project', dir, '-c', 'Release'], {
      encoding: 'utf-8', timeout: 180000, env: Object.assign({}, process.env, { DOTNET_CLI_UI_LANGUAGE: 'en' })
    });
    const out = (run.stdout || '') + (run.stderr || '');
    if (!out.includes('STUBS_OK'))
      throw new Error(out.split('\n').filter(l => /FAIL|error/.test(l)).slice(0, 12).join('\n') || out.slice(-1500));
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* temp dir cleanup is best effort */ }
  }
});

realLog(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed === 0 ? 0 : 1);
