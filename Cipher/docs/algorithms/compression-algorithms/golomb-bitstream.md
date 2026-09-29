# Golomb-BitStream

> Enhanced Golomb coding using OpCodes.BitStream for optimal prefix coding of geometric distributions. Demonstrates advanced bit-level operations for compression algorithms.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Entropy Coding |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Solomon W. Golomb (Enhanced) |
| Year | 1966 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/golomb-bitstream.js`](../../../algorithms/compression/golomb-bitstream.js) |

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

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://en.wikipedia.org/wiki/Boundary_condition)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Rice coding k=2, input=0](https://unix4lyfe.org/rice-coding/)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `020100` |

**Vector 3** — [Rice coding k=2, sequence 0,1,2](https://rosettacode.org/wiki/Rice_coding)

| Field | Value |
| --- | --- |
| `input` | `000102` |
| `expected` | `020318` |

**Vector 4** — [FLAC residual pattern](https://www.rfc-editor.org/rfc/rfc9639.html)

| Field | Value |
| --- | --- |
| `input` | `00000100020100` |
| `expected` | `02070488` |

**Vector 5** — [Rice coding k=2, powers of 2](https://michaeldipperstein.github.io/rice.html)

| Field | Value |
| --- | --- |
| `input` | `04080c10` |
| `expected` | `0204cf3f3fc0` |

---

[← All algorithms](../README.md)
