# 2D Parity Code

> Two-dimensional parity check code arranging data in rectangular grid with row and column parity bits. Can correct single-bit errors and detect two-bit errors when they occur in different rows and columns. Simple yet effective for burst error detection in memory systems.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Product Code |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Unknown (classical technique) |
| Year | 1950 |
| Origin | Not specified |
| Source | [`algorithms/ecc/2d-parity.js`](../../../algorithms/ecc/2d-parity.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Limited Error Correction | Can only correct single-bit errors. Multiple errors in same row/column cannot be corrected. | — |
| Undetectable Error Patterns | Cannot detect errors in rectangular patterns (2x2 grid of errors). | — |

## Documentation

- [Wikipedia - Parity Bit](https://en.wikipedia.org/wiki/Parity_bit)
- [2D Parity Tutorial](https://www.electronics-tutorials.ws/combination/comb_9.html)
- [Error Detection Codes](https://www.cs.cornell.edu/courses/cs6114/2018sp/Handouts/Lec2.pdf)

## References

- [Product Codes](https://en.wikipedia.org/wiki/Product_code)
- [Memory Error Correction](https://ieeexplore.ieee.org/document/1702292)
- [2D Parity in RAID](https://www.usenix.org/legacy/events/fast09/tech/full_papers/plank/plank_html/)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [2D Parity 3x3 all zeros](https://en.wikipedia.org/wiki/Parity_bit)

| Field | Value |
| --- | --- |
| `rows` | `3` |
| `cols` | `3` |
| `input` | `000000000000000000` |
| `expected` | `00000000000000000000000000000000` |

**Vector 2** — [2D Parity 3x3 pattern 1](https://en.wikipedia.org/wiki/Parity_bit)

| Field | Value |
| --- | --- |
| `rows` | `3` |
| `cols` | `3` |
| `input` | `010001000100010001` |
| `expected` | `01000100000100010100010000010001` |

**Vector 3** — [2D Parity 3x3 pattern 2](https://en.wikipedia.org/wiki/Parity_bit)

| Field | Value |
| --- | --- |
| `rows` | `3` |
| `cols` | `3` |
| `input` | `010101000000010101` |
| `expected` | `01010101000000000101010100000000` |

**Vector 4** — [2D Parity 2x2 simple](https://en.wikipedia.org/wiki/Parity_bit)

| Field | Value |
| --- | --- |
| `rows` | `2` |
| `cols` | `2` |
| `input` | `01000001` |
| `expected` | `010001000101010100` |

---

[← All algorithms](../README.md)
