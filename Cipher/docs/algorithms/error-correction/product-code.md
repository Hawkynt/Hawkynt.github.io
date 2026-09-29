# Product Code

> Two-dimensional error correction using row and column parity checks. Can detect and correct single-bit errors by identifying the intersection of failed row and column parities. Efficient for burst error detection.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Block Code |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Unknown (Matrix Coding Concept) |
| Year | 1960 |
| Origin | Not specified |
| Source | [`algorithms/ecc/product-code.js`](../../../algorithms/ecc/product-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Double Error Ambiguity | Can detect but not locate/correct two errors. Multiple errors create ambiguous row/column intersections. | — |
| Corner Case Errors | Errors in parity bits themselves require special handling and may not be correctable. | — |

## Documentation

- [Wikipedia - Multidimensional Parity](https://en.wikipedia.org/wiki/Multidimensional_parity-check_code)
- [Error Correction Zoo - Tensor Product](https://errorcorrectionzoo.org/c/tensor)
- [UMass Interactive Demo](https://gaia.cs.umass.edu/kurose_ross/interactive/2d_parity.php)

## References

- [Two-Dimensional Parity Paper](https://dl.acm.org/doi/pdf/10.1145/321062.321067)
- [2D ECC Survey](https://www.sciencedirect.com/science/article/abs/pii/S002627142200350X)
- [Error Detection Tutorial](https://wiki.eecs.yorku.ca/course_archive/2009-10/W/3213/_media/cse3213_11_errorcorrection_w2010.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Product code 4x4 matrix test](https://gaia.cs.umass.edu/kurose_ross/interactive/2d_parity.php)

| Field | Value |
| --- | --- |
| `input` | `01000100000100010101000000000101` |
| `expected` | `01000100000001000100010100000000000101000000000000` |

**Vector 2** — [Product code all zeros](https://en.wikipedia.org/wiki/Multidimensional_parity-check_code)

| Field | Value |
| --- | --- |
| `input` | `00000000000000000000000000000000` |
| `expected` | `00000000000000000000000000000000000000000000000000` |

**Vector 3** — [Product code identity matrix](https://en.wikipedia.org/wiki/Multidimensional_parity-check_code)

| Field | Value |
| --- | --- |
| `input` | `01000000000100000000010000000001` |
| `expected` | `01000000010001000001000001000100000001010101010100` |

---

[← All algorithms](../README.md)
