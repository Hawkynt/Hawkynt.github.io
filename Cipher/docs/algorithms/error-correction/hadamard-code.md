# Hadamard Code

> Walsh-Hadamard error correction code that encodes k bits into 2^k bits. Can correct up to (2^(k-1) - 1) / 2 errors. Used in Mariner 9 spacecraft and CDMA communication. Highly redundant but powerful for low-rate applications.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Linear Code |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Jacques Hadamard (matrix), Joseph L. Walsh (functions) |
| Year | 1893 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/ecc/hadamard-code.js`](../../../algorithms/ecc/hadamard-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Very Low Code Rate | Code rate is k/2^k, extremely inefficient for large k. Example: k=6 gives rate 6/64 = 9.4%. | — |
| Power-of-2 Constraint | Message length must be a power of 2, limiting flexibility. | — |

## Documentation

- [Wikipedia - Hadamard Code](https://en.wikipedia.org/wiki/Hadamard_code)
- [Error Correction Zoo](https://errorcorrectionzoo.org/c/hadamard)
- [Hadamard Matrices Tutorial](http://homepages.math.uic.edu/~leon/mcs425-s08/handouts/Hadamard_codes.pdf)

## References

- [Mariner 9 Application](https://en.wikipedia.org/wiki/Hadamard_code)
- [Walsh-Hadamard in CDMA](https://www.gaussianwaves.com/2011/03/03/walsh-hadamard-code-matlab-simulation-2/)
- [Fast Decoding Algorithm](https://theory.epfl.ch/courses/topicstcs/Lecture6.pdf)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Hadamard (8,3) all zeros](https://en.wikipedia.org/wiki/Hadamard_code)

| Field | Value |
| --- | --- |
| `input` | `000000` |
| `expected` | `0000000000000000` |

**Vector 2** — [Hadamard (8,3) pattern 001](https://en.wikipedia.org/wiki/Hadamard_code)

| Field | Value |
| --- | --- |
| `input` | `000001` |
| `expected` | `0001000100010001` |

**Vector 3** — [Hadamard (8,3) pattern 010](https://en.wikipedia.org/wiki/Hadamard_code)

| Field | Value |
| --- | --- |
| `input` | `000100` |
| `expected` | `0000010100000101` |

**Vector 4** — [Hadamard (8,3) all ones](https://en.wikipedia.org/wiki/Hadamard_code)

| Field | Value |
| --- | --- |
| `input` | `010101` |
| `expected` | `0001010001000001` |

---

[← All algorithms](../README.md)
