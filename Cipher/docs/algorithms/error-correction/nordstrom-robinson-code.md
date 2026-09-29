# Nordstrom-Robinson Code

> Nonlinear (16, 256, 6) code achieving optimal parameters. Has minimum distance 6, can correct 2 errors and detect 5 errors. Meets the Plotkin bound for binary codes. Notable as the best-known nonlinear code of length 16. Used in theoretical coding research.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Nonlinear Code |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | A. W. Nordstrom, J. P. Robinson |
| Year | 1967 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/nordstrom-robinson.js`](../../../algorithms/ecc/nordstrom-robinson.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Nonlinear Complexity | Nonlinear structure makes encoding/decoding more complex than linear codes. | — |
| Fixed Length | Only defined for length 16, cannot be easily extended to other lengths. | — |

## Documentation

- [Wikipedia - Nordstrom-Robinson](https://en.wikipedia.org/wiki/Nordstrom%E2%80%93Robinson_code)
- [Error Correction Zoo](https://errorcorrectionzoo.org/c/nordstrom_robinson)
- [Nonlinear Codes](https://www.ams.org/notices/200308/what-is.pdf)

## References

- [Original Paper](https://ieeexplore.ieee.org/document/1054045)
- [Construction Methods](https://arxiv.org/pdf/1708.07975.pdf)
- [Decoding Algorithm](https://www.researchgate.net/publication/3209246_Soft-decision_decoding_of_the_Nordstrom-Robinson_code)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Nordstrom-Robinson all zeros](https://en.wikipedia.org/wiki/Nordstrom%E2%80%93Robinson_code)

| Field | Value |
| --- | --- |
| `input` | `0000000000000000` |
| `expected` | `00000000000000000000000000000000` |

**Vector 2** — [Nordstrom-Robinson pattern 1](https://en.wikipedia.org/wiki/Nordstrom%E2%80%93Robinson_code)

| Field | Value |
| --- | --- |
| `input` | `0000000000000001` |
| `expected` | `01010101010101010101010101010101` |

**Vector 3** — [Nordstrom-Robinson pattern 2](https://en.wikipedia.org/wiki/Nordstrom%E2%80%93Robinson_code)

| Field | Value |
| --- | --- |
| `input` | `0000000100000000` |
| `expected` | `00010001000100010001000100010001` |

**Vector 4** — [Nordstrom-Robinson pattern 3](https://en.wikipedia.org/wiki/Nordstrom%E2%80%93Robinson_code)

| Field | Value |
| --- | --- |
| `input` | `0100000000000000` |
| `expected` | `00000000000000000101010101010101` |

---

[← All algorithms](../README.md)
