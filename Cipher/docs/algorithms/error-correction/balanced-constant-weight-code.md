# Balanced Constant Weight Code

> All codewords have same Hamming weight (constant number of 1s). Parameters A(n,d,w) denote maximum codewords of length n, minimum distance d, and constant weight w. Used in optical communications, magnetic recording, and frequency-hopping systems. Can correct errors by exploiting weight property.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Constant Weight Code |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Various (classical construction) |
| Year | 1960 |
| Origin | Not specified |
| Source | [`algorithms/ecc/constant-weight-balanced.js`](../../../algorithms/ecc/constant-weight-balanced.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Limited Message Space | Number of valid codewords limited to C(n,w), restricting information capacity. | — |
| Weight Requirement | Input messages must be encoded to maintain constant weight property. | — |

## Documentation

- [Wikipedia - Constant Weight](https://en.wikipedia.org/wiki/Constant-weight_code)
- [Error Correction Zoo](https://errorcorrectionzoo.org/c/constant_weight)
- [Bounds Tables](http://www.mi.ic.ac.uk/~dmartin/cwcodes.html)

## References

- [Combinatorial Bounds](https://ieeexplore.ieee.org/document/1054245)
- [Optical Communications](https://ieeexplore.ieee.org/document/1055187)
- [Construction Methods](https://link.springer.com/article/10.1007/BF01072842)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [CW (5,2) weight-2 pattern 11000](https://en.wikipedia.org/wiki/Constant-weight_code)

| Field | Value |
| --- | --- |
| `n` | `5` |
| `w` | `2` |
| `input` | `0101000000` |
| `expected` | `0101000000` |

**Vector 2** — [CW (5,2) weight-2 pattern 10100](https://en.wikipedia.org/wiki/Constant-weight_code)

| Field | Value |
| --- | --- |
| `n` | `5` |
| `w` | `2` |
| `input` | `0100010000` |
| `expected` | `0100010000` |

**Vector 3** — [CW (6,3) weight-3 pattern 111000](https://en.wikipedia.org/wiki/Constant-weight_code)

| Field | Value |
| --- | --- |
| `n` | `6` |
| `w` | `3` |
| `input` | `010101000000` |
| `expected` | `010101000000` |

**Vector 4** — [CW (6,3) weight-3 pattern 101010](https://en.wikipedia.org/wiki/Constant-weight_code)

| Field | Value |
| --- | --- |
| `n` | `6` |
| `w` | `3` |
| `input` | `010001000100` |
| `expected` | `010001000100` |

---

[← All algorithms](../README.md)
