# SynthelicZ Cipher Tools - Tests

Two runners, grouped by the question they answer. Each prints one summary line per
category and a single verdict, and exits non-zero when any check of a selected
category fails (`2` for an unknown option or category name). CI runs both with no
arguments.

```bash
node tests/TestSuite.js         # is each algorithm correct?
node tests/TranspilerSuite.js   # does the transpiler work?
```

Every other `.js` file here is a module one of them calls.

## `TestSuite.js` - is each algorithm correct?

Every algorithm file is read, compiled and loaded once; every category works from
that one load.

| Category | Checks | Module |
|---|---|---|
| `compilation` | the file compiles as a Node module | `TestEngine.js` |
| `interface` | it loads and registers at least one algorithm | `TestEngine.js` |
| `metadata` | the metadata follows CONTRIBUTING.md | `TestEngine.js` |
| `issues` | no TODO/FIXME/BUG/ISSUE/HACK markers | `TestEngine.js` |
| `functionality` | every committed vector, with every field of it applied (a field the instance has no setter or property for, or whose setter throws, fails the vector); an algorithm with an inverse must also recover each vector's input | `TestEngine.js` |
| `optimization` | OpCodes instead of raw bit operators | `TestEngine.js` |
| `types` | untyped value sites within the file's budget (see below) | `TypeCoverage.js`, `type-budgets.json` |
| `soundness` | the types present are right: the values the file's first vector per algorithm puts through its typed sites fit their IL types, within the file's budget (see below) | `TypeSoundness.js`, `type-soundness-budgets.json` |
| `roundtrip` | every reversible algorithm decodes its own output over an adversarial corpus, and compressors compress; interoperability with zlib/bzip2 is reported, never gating | `RoundTrip.js` |
| `chunked` | `Feed(whole)` equals `Feed(part1); Feed(part2); ...` for every split | `ChunkedFeed.js` |
| `browser` | every script tag of `index.html` evaluates in page order with no `require`, `module` or `global` | `BrowserLoad.js` |
| `library` | unit tests of the OpCodes helpers, `ByteBuffer`, the runners' category selection and summary, of algorithm paths no committed vector reaches (lengths beyond 2^32 bits, a missing dependency), and of how the test engine applies a vector's fields | `OpCodesHelperTests.js`, `ByteBufferTests.js`, `RunnerTests.js`, `AlgorithmRegressionTests.js`, `TestEngineTests.js` |

Hashes, MACs, KDFs, random generators and the algorithms named in
`round-trip-exemptions.js` have no inverse: `functionality` does not round-trip
them and prints no round-trip counter for them.

`browser` and `library` check the whole collection, so a run narrowed to a file,
category or algorithm leaves them out unless `--only` names them.

```bash
node tests/TestSuite.js rijndael.js               # one file
node tests/TestSuite.js --category=hash           # one category directory
node tests/TestSuite.js --algorithm=murmurhash3   # the file(s) with that base name
node tests/TestSuite.js --only=roundtrip,chunked  # only these categories
node tests/TestSuite.js --skip=types              # everything but these
node tests/TestSuite.js --verbose                 # every vector and every untyped value site
node tests/TestSuite.js --update-type-budgets     # lower TYPES and SOUNDNESS budgets to the current counts
node tests/TestSuite.js --update-type-budgets --allow-budget-increase   # also raise or add budgets
node tests/TestSuite.js --only=roundtrip --large              # also push 1MB through each algorithm
node tests/TestSuite.js --only=roundtrip --large-size=8M      # another size (see LARGE-INPUTS.md)
node tests/TestSuite.js --only=roundtrip --budget=10000       # ms per algorithm for the small corpus
node tests/TestSuite.js --only=soundness --soundness-vectors=0 --verbose   # every vector, every mismatch (not gated)
```

### Types: the type resolution policy

The transpiler types every value from, in this order: **1.** OpCodes JSDoc (every
OpCodes argument and result), **2.** the AlgorithmFramework interfaces (`Feed`,
`Result`, `BlockSize`, `OutputSize`, ...), **3.** the algorithm file's own JSDoc
(`@type` on constants, tables and `this.field` assignments, `@param`/`@returns` on
helpers and methods); a sibling data module the file requires (`./x.data.js`) is typed
by its own JSDoc the same way, so its classes, functions and `@type` tables keep their
types where the file destructures them. Anything else is a guess: a table typed by its literal
magnitudes, `data || []`, raw `a + b` on fixed-width values, `OpCodes.XorN` (BigInt)
applied to numbers, an unannotated parameter.

`TypeCoverage.js` parses a file into the same typed IL AST the language emitters use
and counts those sites (value positions only; declaration names, keys, callees,
conditions and test vectors are not values), attributing each to the tier whose gap it
is. `type-budgets.json` holds each file's budget: TYPES fails when a file's count
rises above it, a budget of 0 means the file is policy-clean, and
`--update-type-budgets` only ever lowers budgets (`--allow-budget-increase` must be
given as well to raise one or add a file). `--verbose` lists every site with file, line,
expression, tier and reason. That tiers 1 and 2 are themselves fully typed is the
`jsdoc` category of `TranspilerSuite.js`.

### Soundness: are the types right?

TYPES checks that a type is present; a site typed `uint8` that holds 300, `uint32`
holding a negative number or a fraction, `int32` where a BigInt flows, or `uint8[]`
that is a `Uint32Array` passes it and still emits wrong code in a typed language.
`TypeSoundness.js` takes the same IL AST, wraps the file's typed sites in the source
itself (initialisers, assignments to variables, fields and array elements, `++`/`--`,
returns, `push` arguments; line numbers are kept), loads that copy under the file's
name, runs its algorithms' vectors and checks every value against the IL type of its
site: integer range and integrality, Number or BigInt, boolean, string, and an array's
typed-array kind and sampled elements. For an assignment the type checked is the
storage's (the variable's declaration, the field's final type), as an emitter declares
it. A site checks its first 256 values and 16 more per later vector, so a hot loop
costs a compare once its budget is spent; `Math.random` is seeded, so counts repeat.

`--verbose` lists each mismatch with file, line, expression, the role of the type
(`variable`, `field`, `element`, `return`, `value`), the type, the kind of mismatch,
sample values, and where the type came from: `opcodes`/`framework`/`local-jsdoc` (a
tier's JSDoc), `literal-init` (a variable typed by its integer literal initialiser),
`local-untyped` (an operator on untyped operands) or `inference` (the transpiler).
`type-soundness-budgets.json` holds the number of mismatching sites of each file that
has any (a file without an entry has budget 0), ratcheted like the TYPES budgets. The
category runs the first vector of each algorithm (about +27 s for the collection);
`--soundness-vectors=N` runs more (0: all, about +160 s) and reports what it finds, but
only the default depth is held to the budgets. The checker itself is the `soundness`
category of `TranspilerSuite.js`.

## `TranspilerSuite.js` - does the transpiler work?

| Category | Checks | Module |
|---|---|---|
| `codegen` | every language plugin and dialect generates code for the shared AST test cases | `CodeGenTests.js` |
| `inference` | type inference of the shared transpiler AST | `TypeInferenceTests.js` |
| `policy` | the type resolution order and the untyped-site count built on it | `TypePolicyTests.js` |
| `soundness` | the type-soundness checker: value predicates of each IL type, instrumentation, sampling, a run over a probe file | `TypeSoundnessTests.js` |
| `jsdoc` | every OpCodes and AlgorithmFramework member is fully typed by JSDoc | `JSDocTierAudit.js` |
| `csharp` | regressions of systematic C# transpilation faults; compiles and runs the C# runtime stubs when the .NET SDK is installed | `CSharpTranspileRegressions.js` |
| `validation` | transpiles every algorithm to every installed language, compiles it, and runs its vectors where the language is interpreted | `TranspilerValidation.js` |

`validation` takes over ten minutes unscoped and its result depends on the
toolchains installed (gcc, g++, dotnet, java, python, php, perl, ruby, go, rustc,
...), so it runs only when `--only` names it and CI does not run it. A language
passes when every algorithm it transpiled also compiled. Generated sources go to
`tests/transpiler-validation-output/`.

```bash
node tests/TranspilerSuite.js --only=codegen --language=python --quick
node tests/TranspilerSuite.js --only=inference --group=literal   # groups whose name contains "literal"
node tests/TranspilerSuite.js --only=csharp --no-dotnet          # skip compiling the C# stubs
node tests/TranspilerSuite.js --only=validation --quick           # 3 algorithms per category
node tests/TranspilerSuite.js --only=validation --category=block --language=csharp
node tests/TranspilerSuite.js --only=validation --algorithm=tea   # algorithm files whose name contains "tea"
node tests/TranspilerSuite.js --only=validation --compile-only --report
```

To add a language to `validation`: add its compiler detection to
`LANGUAGE_COMPILERS` in `TranspilerValidation.js`, a test harness generator
(`generateXxxTestHarness`), a compile or syntax check (`testXxxCompilation`) and,
for an interpreted language, an execution function. The language plugin itself is
picked up from `codingplugins/`.

## Shared modules

- `TestEngine.js` - loads a file and runs its vectors; also loaded by `index.html`, so the page runs the same vector logic
- `round-trip-exemptions.js` - the algorithms with no meaningful inverse, with the reason for each; also loaded by `index.html`
- `DummyBlockCipher.js` - the identity cipher cipher modes are tested with; also loaded by `index.html`
- `TypeCoverage.js`, `type-budgets.json` - the TYPES count and its budgets
- `TypeSoundness.js`, `type-soundness-budgets.json` - the SOUNDNESS check and its budgets
- `CategoryRunner.js` - `--only`/`--skip` selection and the summary, shared by both runners
- `UnitCases.js` - named given/when/then cases run on demand
- `LARGE-INPUTS.md` - the measured size ceilings of the large round-trip tier
