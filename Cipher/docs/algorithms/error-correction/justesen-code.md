# Justesen Code

> First asymptotically good codes with constant rate, constant relative distance, and constant alphabet size. Constructed by concatenating Reed-Solomon outer code with Wozencraft ensemble inner codes. Discovered by Jørn Justesen in 1972. Used to prove existence of codes meeting Gilbert-Varshamov bound.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Concatenated Code |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Jørn Justesen |
| Year | 1972 |
| Origin | Not specified |
| Source | [`algorithms/ecc/justesen-code.js`](../../../algorithms/ecc/justesen-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Decoding Complexity | Concatenated structure requires two-stage decoding (outer RS + inner Wozencraft). | — |
| Alphabet Size | Binary codes derived from larger alphabet, affecting practical implementation. | — |

## Documentation

- [Wikipedia - Justesen Code](https://en.wikipedia.org/wiki/Justesen_code)
- [Error Correction Zoo](https://errorcorrectionzoo.org/c/justesen)
- [Lecture Notes](https://cse.buffalo.edu/faculty/atri/courses/coding-theory/lectures/lect25.pdf)

## References

- [Original Justesen Paper](https://ieeexplore.ieee.org/document/1054776)
- [Weight Distribution](https://ieeexplore.ieee.org/document/1228083/)
- [Asymptotically Good Codes](https://web.math.princeton.edu/~nalon/PDFS/goodcode.pdf)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Justesen code all zeros](https://en.wikipedia.org/wiki/Justesen_code)

| Field | Value |
| --- | --- |
| `input` | `00000000` |
| `expected` | `0000000000000000` |

**Vector 2** — [Justesen code pattern 1000](https://errorcorrectionzoo.org/c/justesen)

| Field | Value |
| --- | --- |
| `input` | `01000000` |
| `expected` | `0100010000000000` |

**Vector 3** — [Justesen code pattern 0100](https://errorcorrectionzoo.org/c/justesen)

| Field | Value |
| --- | --- |
| `input` | `00010000` |
| `expected` | `0001000100000000` |

**Vector 4** — [Justesen code pattern 1100](https://errorcorrectionzoo.org/c/justesen)

| Field | Value |
| --- | --- |
| `input` | `01010000` |
| `expected` | `0101010100000000` |

---

[← All algorithms](../README.md)
