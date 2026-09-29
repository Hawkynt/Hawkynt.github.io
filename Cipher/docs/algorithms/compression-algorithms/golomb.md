# Golomb

> Golomb coding is a lossless data compression method using prefix codes optimized for geometric distributions. Rice coding (power-of-2 parameters) is included as a special case.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Entropy Coding |
| Security status | Not classified |
| Complexity | Not specified |
| Inventor | Solomon W. Golomb |
| Year | 1966 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/golomb.js`](../../../algorithms/compression/golomb.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Wikipedia - Golomb Coding](https://en.wikipedia.org/wiki/Golomb_coding)
- [Wikipedia - Rice Coding](https://en.wikipedia.org/wiki/Rice_coding)

## References

- [Run-length encodings](https://ieeexplore.ieee.org/document/1054904)
- [Information Theory Foundations](https://web.stanford.edu/class/ee376a/)

## Test vectors

9 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://en.wikipedia.org/wiki/Boundary_condition)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `0100000000` |

**Vector 2** — [Golomb parameter auto-selects m=1 for input=0](https://en.wikipedia.org/wiki/Golomb_coding)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `010100000000` |

**Vector 3** — [Golomb parameter auto-selects m=2 for input=3](https://rosettacode.org/wiki/Rice_coding)

| Field | Value |
| --- | --- |
| `input` | `03` |
| `expected` | `0201000000a0` |

**Vector 4** — [Sequential integers 0-4](https://unix4lyfe.org/rice-coding/)

| Field | Value |
| --- | --- |
| `input` | `0001020304` |
| `expected` | `01050000005bbc` |

**Vector 5** — [Geometric distribution pattern](https://en.wikipedia.org/wiki/Golomb_coding)

| Field | Value |
| --- | --- |
| `input` | `0000010002010003` |
| `expected` | `0108000000269c` |

**Vector 6** — [Powers of 2 sequence](https://en.wikipedia.org/wiki/Rice_coding)

| Field | Value |
| --- | --- |
| `input` | `01020408` |
| `expected` | `03040000004eb6` |

**Vector 7** — [Repetitive run (10 bytes) - auto-selected M tracks the mean, keeping the code compact](https://en.wikipedia.org/wiki/Golomb_coding)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161` |
| `expected` | `430a0000009e9e9e9e9e9e9e9e9e9e` |

**Vector 8** — [Alternating pattern (16 bytes) - two distinct byte values](https://en.wikipedia.org/wiki/Golomb_coding)

| Field | Value |
| --- | --- |
| `input` | `61626162616261626162616261626162` |
| `expected` | `44100000009d9e9d9e9d9e9d9e9d9e9d9e9d9e9d9e` |

**Vector 9** — [Binary/random sample (16 bytes) - non-geometric distribution stress test](https://en.wikipedia.org/wiki/Golomb_coding)

| Field | Value |
| --- | --- |
| `input` | `4080c000000040808000000000000000` |
| `expected` | `1e10000000c6f2bf3800063795e50000000000` |

---

[← All algorithms](../README.md)
