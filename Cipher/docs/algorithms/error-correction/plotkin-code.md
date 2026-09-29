# Plotkin Code

> Linear binary codes achieving Plotkin bound (maximum minimum distance) via recursive |u|u+v| construction. Starting from [2,2,1] repetition code base, generates [2n, n+1, n] codes with optimal distance properties. Related to Hadamard matrices and first-order Reed-Muller codes.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Linear Code |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Morris Plotkin |
| Year | 1960 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/plotkin-code.js`](../../../algorithms/ecc/plotkin-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Power-of-2 Block Length | Block length must be power of 2 (2, 4, 8, 16, ...), limiting flexibility. | — |
| Low Code Rate | Code rate (n+1)/(2n) approaches 0.5 asymptotically, moderate efficiency. | — |

## Documentation

- [Error Correction Zoo - (u|u+v) construction](https://errorcorrectionzoo.org/c/uplusv)
- [Wikipedia - Plotkin bound](https://en.wikipedia.org/wiki/Plotkin_bound)
- [ArXiv - Plotkin construction rank and kernel](https://arxiv.org/abs/0707.3878)

## References

- [MacWilliams and Sloane - Theory of Error-Correcting Codes](https://archive.org/details/theoryoferrorcor0000macw)
- [Recursive Plotkin Construction Decoding](https://www.researchgate.net/publication/286929473_Recursive_Codes_with_the_Plotkin-Construction_and_Their_Decoding)
- [Plotkin construction: rank and kernel](https://www.researchgate.net/publication/1757474_Plotkin_construction_Rank_and_Kernel)

## Test vectors

14 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Plotkin [2,2,1] base case - bits 00](https://errorcorrectionzoo.org/c/uplusv)

| Field | Value |
| --- | --- |
| `level` | `0` |
| `input` | `0000` |
| `expected` | `0000` |

**Vector 2** — [Plotkin [2,2,1] base case - bits 01](https://errorcorrectionzoo.org/c/uplusv)

| Field | Value |
| --- | --- |
| `level` | `0` |
| `input` | `0001` |
| `expected` | `0001` |

**Vector 3** — [Plotkin [2,2,1] base case - bits 10](https://errorcorrectionzoo.org/c/uplusv)

| Field | Value |
| --- | --- |
| `level` | `0` |
| `input` | `0100` |
| `expected` | `0100` |

**Vector 4** — [Plotkin [2,2,1] base case - bits 11](https://errorcorrectionzoo.org/c/uplusv)

| Field | Value |
| --- | --- |
| `level` | `0` |
| `input` | `0101` |
| `expected` | `0101` |

**Vector 5** — [Plotkin [4,3,2] level 1 - all zeros](https://errorcorrectionzoo.org/c/uplusv)

| Field | Value |
| --- | --- |
| `level` | `1` |
| `input` | `000000` |
| `expected` | `00000000` |

**Vector 6** — [Plotkin [4,3,2] level 1 - pattern 001](https://errorcorrectionzoo.org/c/uplusv)

| Field | Value |
| --- | --- |
| `level` | `1` |
| `input` | `000001` |
| `expected` | `00000100` |

**Vector 7** — [Plotkin [4,3,2] level 1 - pattern 010](https://errorcorrectionzoo.org/c/uplusv)

| Field | Value |
| --- | --- |
| `level` | `1` |
| `input` | `000100` |
| `expected` | `00010001` |

**Vector 8** — [Plotkin [4,3,2] level 1 - pattern 011](https://errorcorrectionzoo.org/c/uplusv)

| Field | Value |
| --- | --- |
| `level` | `1` |
| `input` | `000101` |
| `expected` | `00010101` |

**Vector 9** — [Plotkin [4,3,2] level 1 - pattern 100](https://errorcorrectionzoo.org/c/uplusv)

| Field | Value |
| --- | --- |
| `level` | `1` |
| `input` | `010000` |
| `expected` | `01000100` |

**Vector 10** — [Plotkin [4,3,2] level 1 - all ones](https://errorcorrectionzoo.org/c/uplusv)

| Field | Value |
| --- | --- |
| `level` | `1` |
| `input` | `010101` |
| `expected` | `01010001` |

**Vector 11** — [Plotkin [8,5,4] level 2 - all zeros](https://errorcorrectionzoo.org/c/uplusv)

| Field | Value |
| --- | --- |
| `level` | `2` |
| `input` | `0000000000` |
| `expected` | `0000000000000000` |

**Vector 12** — [Plotkin [8,5,4] level 2 - pattern 00001](https://errorcorrectionzoo.org/c/uplusv)

| Field | Value |
| --- | --- |
| `level` | `2` |
| `input` | `0000000001` |
| `expected` | `0000000000010001` |

**Vector 13** — [Plotkin [8,5,4] level 2 - pattern 10000](https://errorcorrectionzoo.org/c/uplusv)

| Field | Value |
| --- | --- |
| `level` | `2` |
| `input` | `0100000000` |
| `expected` | `0100010001000100` |

**Vector 14** — [Plotkin [8,5,4] level 2 - all ones](https://errorcorrectionzoo.org/c/uplusv)

| Field | Value |
| --- | --- |
| `level` | `2` |
| `input` | `0101010101` |
| `expected` | `0101000100000100` |

---

[← All algorithms](../README.md)
