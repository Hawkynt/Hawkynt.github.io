# Density (Chameleon)

> Predictive 4-byte-chunk dictionary coder: a hash of the previous chunk predicts the next one, and a correct prediction costs zero payload bytes - only a signature bit. Optimized for speed over compression ratio.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary-based |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Guillaume Voirin |
| Year | 2015 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/compression/density.js`](../../../algorithms/compression/density.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Density GitHub Repository](https://github.com/g1mv/density)
- [Chameleon Analysis by Charles Bloom](http://cbloomrants.blogspot.com/2015/03/03-25-15-density-chameleon.html)
- [Density Wikipedia](https://en.wikipedia.org/wiki/Density_(compression))

## References

- [Original Density Implementation (Rust)](https://github.com/g1mv/density)
- [Squash Compression Benchmark](https://quixdb.github.io/squash/)
- [CompressionWorkbench DensityChameleonCompressor (reference implementation)](https://github.com/Hawkynt)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - still emits the 4-byte length header](https://github.com/g1mv/density)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Simple 4-byte literal (ABCD)](https://github.com/g1mv/density)

| Field | Value |
| --- | --- |
| `input` | `41424344` |
| `expected` | `040000000100000041424344` |

**Vector 3** — [Repetition pattern (ABCDABCD) - the prediction hash comes from the PREVIOUS chunk, so an immediate repeat is not itself a hit: both chunks are literals](https://github.com/g1mv/density)

| Field | Value |
| --- | --- |
| `input` | `4142434441424344` |
| `expected` | `08000000030000004142434441424344` |

**Vector 4** — [Long repetition (AAAABBBBAAAABBBB) - the AAAA->BBBB transition recurs, so the 4th chunk (following a BBBB, same as when the 2nd chunk followed AAAA) is a correct zero-payload prediction](https://github.com/g1mv/density)

| Field | Value |
| --- | --- |
| `input` | `41414141424242424141414142424242` |
| `expected` | `1000000007000000414141414242424241414141` |

**Vector 5** — [Mixed data - Hello World! (12 bytes = 3 chunks, all literals)](https://github.com/g1mv/density)

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f20576f726c6421` |
| `expected` | `0c0000000700000048656c6c6f20576f726c6421` |

**Vector 6** — Regression: 256 repeated bytes - zero-payload matches after the first literal

Source: Regression test for correct-prediction zero-payload encoding

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `0001000003000000616161616161616100000000` |

---

[← All algorithms](../README.md)
