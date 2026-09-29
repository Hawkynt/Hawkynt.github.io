# Preparata Code

> Nonlinear codes with parameters [2^m, k=2^m-2m-1, d=5] achieving good parameters. The (16,2048,5) code can correct 2 errors. Constructed using cosets of first-order Reed-Muller codes. Notable for being nonlinear yet achieving parameters better than many linear codes. Related to Kerdock codes.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Nonlinear Code |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Franco P. Preparata |
| Year | 1968 |
| Origin | 🇮🇹 Italy |
| Source | [`algorithms/ecc/preparata-code.js`](../../../algorithms/ecc/preparata-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Nonlinear Complexity | Nonlinear structure makes encoding/decoding more complex than linear codes. | — |
| Power-of-2 Lengths | Only defined for length 2^m, limiting flexibility. | — |

## Documentation

- [Wikipedia - Preparata Code](https://en.wikipedia.org/wiki/Preparata_code)
- [Error Correction Zoo](https://errorcorrectionzoo.org/c/preparata)
- [Nonlinear Codes](https://www.maths.qmul.ac.uk/~pjc/csgnotes/preparata.pdf)

## References

- [Preparata's Original Paper](https://ieeexplore.ieee.org/document/1054118)
- [Construction Methods](https://www.sciencedirect.com/science/article/pii/0097316583900172)
- [Kerdock-Preparata Duality](https://arxiv.org/abs/math/0703273)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Preparata (16,7) all zeros](https://en.wikipedia.org/wiki/Preparata_code)

| Field | Value |
| --- | --- |
| `input` | `00000000000000` |
| `expected` | `00000000000000000000000000000000` |

**Vector 2** — [Preparata (16,7) pattern 1](https://en.wikipedia.org/wiki/Preparata_code)

| Field | Value |
| --- | --- |
| `input` | `00000000000001` |
| `expected` | `01010101010101010101010101010101` |

**Vector 3** — [Preparata (16,7) pattern 2](https://en.wikipedia.org/wiki/Preparata_code)

| Field | Value |
| --- | --- |
| `input` | `00000000010000` |
| `expected` | `00000000010101010000000001010101` |

**Vector 4** — [Preparata (16,7) pattern 3](https://en.wikipedia.org/wiki/Preparata_code)

| Field | Value |
| --- | --- |
| `input` | `00000001000000` |
| `expected` | `00000101000001010000010100000101` |

---

[← All algorithms](../README.md)
