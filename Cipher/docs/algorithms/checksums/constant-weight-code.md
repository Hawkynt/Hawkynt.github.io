# Constant Weight Code

> Error detection code where all valid codewords have the same Hamming weight (m-of-n codes). Can detect all unidirectional errors by verifying constant number of 1-bits. Used in balanced transmission and self-checking circuits.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Unidirectional Error Detection |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Unknown (Coding Theory Concept) |
| Year | 1960 |
| Origin | Not specified |
| Source | [`algorithms/checksum/constant-weight.js`](../../../algorithms/checksum/constant-weight.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| No Error Correction | Constant weight codes can only detect errors, not correct them (basic variant). | — |
| Limited Code Space | Only C(n,m) valid codewords exist, limiting information capacity. | — |

## Notes

- Result() returns the codeword unchanged; this class checks a codeword, it does not encode one.
- A weight violation is only reported on the console, so callers cannot act on it - use DetectError() instead, which does return a verdict.
- Because Result() carries no verdict, an invalid codeword cannot be expressed as a test vector.

## Documentation

- [Wikipedia - Constant Weight Code](https://en.wikipedia.org/wiki/Constant-weight_code)
- [Error Correction Zoo](https://errorcorrectionzoo.org/c/constant_weight)
- [IEEE Paper on CW Codes](https://ieeexplore.ieee.org/document/669415)

## References

- [Single Error Correction](https://ieeexplore.ieee.org/abstract/document/1053719)
- [Classification of CW Codes](https://www.researchgate.net/publication/224155507_Classification_of_Binary_Constant_Weight_Codes)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [3-of-5 codeword with weight 3 (0 1 0 1 1)](https://en.wikipedia.org/wiki/Constant-weight_code)

| Field | Value |
| --- | --- |
| `weight` | `3` |
| `length` | `5` |
| `input` | `0001000101` |
| `expected` | `0001000101` |

**Vector 2** — [3-of-5 codeword with weight 3 (1 1 1 0 0)](https://en.wikipedia.org/wiki/Constant-weight_code)

| Field | Value |
| --- | --- |
| `weight` | `3` |
| `length` | `5` |
| `input` | `0101010000` |
| `expected` | `0101010000` |

**Vector 3** — [2-of-4 codeword with weight 2 (1 0 1 0)](https://errorcorrectionzoo.org/c/constant_weight)

| Field | Value |
| --- | --- |
| `weight` | `2` |
| `length` | `4` |
| `input` | `01000100` |
| `expected` | `01000100` |

**Vector 4** — [2-of-4 codeword with weight 2 (0 1 0 1)](https://errorcorrectionzoo.org/c/constant_weight)

| Field | Value |
| --- | --- |
| `weight` | `2` |
| `length` | `4` |
| `input` | `00010001` |
| `expected` | `00010001` |

---

[← All algorithms](../README.md)
