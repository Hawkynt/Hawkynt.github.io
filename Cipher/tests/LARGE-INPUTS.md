# Large inputs

What actually happens when an algorithm is handed tens of megabytes, where the limits
are, and what fails first beyond them. Every figure here was measured on a 64-bit
Windows host with 32 GB of RAM, Node.js v22.

## The hard ceiling: about 107 MB

Every algorithm buffers its input in a plain JavaScript array and appends one element
per byte. V8 refuses to grow such an array beyond its backing-store limit. Measured:

```
{"diedAt":112813858,"error":"RangeError: Invalid array length","rssMB":2282,"bytesPerElement":21.21}
```

**112,813,858 elements — 107.6 MB — and it is a hard limit, not a memory limit.**
Raising `--max-old-space-size` does not move it. Past that point the harness fails to
build its own corpus before any algorithm runs, which is why
`RoundTripSuite.js` refuses a `--large-size` above 112,000,000 with an explicit
message rather than dying inside V8.

The cost per element was measured at 21.2 bytes of RSS during the growth loop, and
about 12 bytes once settled. A byte array therefore costs roughly 12x its nominal
size, and a typed array costs 1x:

| accumulator | bytes of process memory per input byte |
|---|---|
| plain array grown with `push` | ~12 live, ~21 peak |
| `Uint8Array` | ~1 |

## What fails first, and at what size

| Limit | Fires at | Affects |
|---|---|---|
| One array element per **bit** | **~12.5 MB** | was Arithmetic Coding — **fixed**, see below |
| Spreading a data-sized array into a call | **~125 KB** | was 17 of 20 encoding schemes — **fixed**, see below |
| One array element per **byte** | **~107.6 MB** | everything |
| `Int32Array` cost accumulator | ~227 MB | Crush — unreachable behind the 107 MB ceiling |
| 32-bit wire field for a bit count | ~390 MB | tANS — unreachable |
| `Shr32` on a bit position | ~512 MB | LZFSE — unreachable |

### The argument-count limit — fixed

`String.fromCharCode(...data)` passes one argument per byte. V8 accepts about 125,000
arguments and then raises `RangeError: Maximum call stack size exceeded`. Seventeen of
the twenty encoding schemes did this, so **they failed at roughly 0.12 MB** — three
orders of magnitude below every other limit here, and by far the most reachable defect
found.

`OpCodes.BytesToChars(bytes)` now does the same conversion in 4096-byte chunks, and
all data-sized call sites in `algorithms/encoding/` use it. Spreads over the fixed
alphabets (16 to 91 characters) are left alone; they cannot overrun anything.
Koremutake additionally had two `target.push(...source)` spreads, replaced with loops.

Measured over the whole `Encoding Schemes` category at 200,000 bytes:

| | before | after |
|---|---|---|
| round-trip byte-exact | 3 of 20 | **19 of 20** |

The twentieth is Koremutake, which now completes rather than throwing, but is
quadratic by construction: it converts the entire input to a single `BigInt` and then
divides it down by 128 repeatedly. That is an algorithmic property of base conversion
over an arbitrary-precision integer, not a bug, and it is flagged rather than
rewritten.

### Arithmetic Coding — one array element per bit — fixed

`algorithms/compression/arithmetic.js` used to accumulate its output as one array
element per *output bit*, both when encoding (`this.bits = []`) and when decoding (the
input was expanded to `const bits = []` at eight elements per compressed byte). That
divided the 107.6 MB ceiling by eight, giving **a ceiling of about 12.5 MB** — the
lowest of any compression algorithm in the collection. Measured:

```
8 MB   ok 6857146 bytes, 4956ms
16 MB  RangeError: Invalid array length, at this.bits.push(bit) in _outputBit
```

The coder now writes through `MsbBitWriter`, which packs eight bits into each output
byte as they are produced, and reads through `MsbBitReader`, which takes bits straight
out of the compressed bytes. Both are byte-oriented, the way `deflate.js` and
`zopfli.js` already worked. Nothing about the format changed — the bit order and the
zero padding of the final byte are what the old packing loop produced — so the
compressed bytes are identical at every size and the cross-check against
CompressionWorkbench still reports the pair as byte-identical.

| | before | after |
|---|---|---|
| ceiling | ~12.5 MB | the collection-wide ~107.6 MB |
| 16 MB round-trip | `RangeError` | ok, 14910021 bytes, 5.7 s |
| 32 MB round-trip | `RangeError` | ok, 1387 MB peak RSS |

### Precision, not overflow

JavaScript numbers are exact to 2^53, so a bit position held as a plain number does
not wrap the way a C# `int` does — the bit-position bugs that had to be fixed on the
CompressionWorkbench side have no counterpart here. The remaining hazards are values
forced back to 32 bits by an OpCodes helper, and products that leave the safe-integer
range:

- `tans.js` writes its total bit count through `OpCodes.ToUint32`, a 32-bit field.
  Wraps at 2^32 bits, roughly 390 MB of input. Unreachable behind the 107 MB ceiling.
- `lzfse.js` takes a bit position through `OpCodes.Shr32`, which truncates to 32 bits.
  Wraps at 512 MB of compressed payload. Unreachable.
- `crush.js` accumulates a cumulative bit cost in an `Int32Array`, which saturates at
  roughly 227 MB of input and would degrade the parse (worse ratio, still a valid
  stream). Unreachable.
- `arithmetic.js` multiplies a range of up to 2^32 by a total frequency that grows
  with the input. Exactness needs `2^32 * totalFreq <= 2^53`, so it holds only up to
  about **2 MB** of input. Above that the products round. Encoder and decoder evaluate
  the same expression on the same doubles for the interval bounds, so the rounding is
  symmetric and round-trips were verified byte-exact at 1, 2.5, 4 and 8 MB; the
  asymmetric target computation in the decoder is the residual risk. Flagged as a
  latent precision hazard with a defined onset, not a reproduced corruption.

Checked and found clean: every `Math.imul` in `algorithms/compression/` multiplies a
data word rather than a position; `deflate.js` and `deflate64.js` bound their
`uncompressedBits` estimate by a 32768-byte block, exactly as the C# side does;
`shannon-fano.js` builds its codes from the rescaled 16-bit table the decoder will
see, so encoder and decoder agree; and the bit-position accumulators in `brotli.js`,
`reduce.js`, `implode.js`, `adaptive-huffman.js`, `exp-golomb.js`, `lzham.js`,
`lzwl.js`, `zstd.js`, `fse.js`, `ctw.js` and `OpCodes._BitStream` all use
`Math.floor(pos / 8)` and `pos % 8`, which stay exact to 2^53.

## Running the large tier

The tier runs one child process per algorithm. That structure exists because running
everything in one process exhausts V8's heap partway through and aborts the whole
sweep with only a native stack trace; per-algorithm isolation reclaims memory between
runs and names the algorithm that failed.

```
node tests/RoundTripSuite.js --large                 # the 1MB tier, unchanged
node tests/RoundTripSuite.js --large-size=8M         # any size up to 112000000 bytes
node tests/RoundTripSuite.js --large-size=16M --category "Compression Algorithms"
node tests/RoundTripSuite.js --large-size=4M --algorithm "Unary Coding"
```

`--large-size` accepts a plain byte count or a `K`/`M` suffix, and implies `--large`.
The child's timeout and heap limit scale with the requested size: the timeout is the
1 MB tier's five minutes multiplied by the size in megabytes, and the heap is set to
200x the input, which is the measured peak ratio at 1 MB with headroom. Sizes above
112,000,000 bytes are rejected with an explanation rather than attempted.

A timeout is reported as `SLOW` and does not fail the run; a content mismatch, a
throw, or an out-of-memory does.
