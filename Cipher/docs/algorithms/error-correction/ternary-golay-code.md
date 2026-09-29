# Ternary Golay Code

> Perfect [11,6,5] ternary linear code over GF(3) with 729 codewords. Can correct 2 ternary symbol errors. Minimum distance 5. One of only five perfect codes. Discovered by Marcel Golay in 1949. Used in quantum computing and magic state distillation. Quadratic residue code construction.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Perfect Code |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Marcel J. E. Golay |
| Year | 1949 |
| Origin | 🇨🇭 Switzerland |
| Source | [`algorithms/ecc/ternary-golay.js`](../../../algorithms/ecc/ternary-golay.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Fixed Parameters | Only defined for [11,6,5] parameters, cannot be extended or shortened. | — |
| Ternary Alphabet | Requires ternary symbols (0,1,2) instead of binary, complicating hardware implementation. | — |

## Documentation

- [Wikipedia - Ternary Golay](https://en.wikipedia.org/wiki/Ternary_Golay_code)
- [Error Correction Zoo](https://errorcorrectionzoo.org/c/ternary_golay)
- [Perfect Codes List](https://errorcorrectionzoo.org/list/perfect)

## References

- [Golay's Original Paper](https://ieeexplore.ieee.org/document/1697575)
- [Decoding Algorithm](https://ieeexplore.ieee.org/document/256511)
- [Python Implementation](https://www.johndcook.com/blog/2022/02/07/ternary-golay/)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Ternary Golay all zeros](https://en.wikipedia.org/wiki/Ternary_Golay_code)

| Field | Value |
| --- | --- |
| `input` | `000000000000` |
| `expected` | `0000000000000000000000` |

**Vector 2** — [Ternary Golay pattern [1,0,0,0,0,0]](https://en.wikipedia.org/wiki/Ternary_Golay_code)

| Field | Value |
| --- | --- |
| `input` | `010000000000` |
| `expected` | `0100000000000101020201` |

**Vector 3** — [Ternary Golay pattern [0,1,0,0,0,0]](https://en.wikipedia.org/wiki/Ternary_Golay_code)

| Field | Value |
| --- | --- |
| `input` | `000100000000` |
| `expected` | `0001000000000102010102` |

**Vector 4** — [Ternary Golay pattern [2,1,0,0,0,0]](https://en.wikipedia.org/wiki/Ternary_Golay_code)

| Field | Value |
| --- | --- |
| `input` | `020100000000` |
| `expected` | `0201000000000001020201` |

---

[← All algorithms](../README.md)
