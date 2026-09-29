# Concatenated Code

> Powerful error correction combining inner and outer codes. Outer code (e.g., Reed-Solomon) protects against burst errors, inner code (e.g., convolutional) handles random errors. Achieves near-capacity performance with polynomial decoding complexity.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Concatenated Code |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Dave Forney |
| Year | 1966 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/concatenated.js`](../../../algorithms/ecc/concatenated.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Decoding Delay | Two-stage decoding introduces latency. Outer decoder must wait for all inner codewords. | — |
| Error Propagation | Uncorrected errors from inner decoder appear as symbol erasures to outer decoder. | — |

## Documentation

- [Wikipedia - Concatenated Error Correction](https://en.wikipedia.org/wiki/Concatenated_error_correction_code)
- [Error Correction Zoo](https://errorcorrectionzoo.org/c/concatenated)
- [Scholarpedia Article](http://www.scholarpedia.org/article/Concatenated_codes)

## References

- [Forney's Original Paper](https://ieeexplore.ieee.org/document/1053696)
- [NASA Deep Space Standard](https://ntrs.nasa.gov/citations/19840023922)
- [Rutgers Lecture Notes](https://sites.math.rutgers.edu/~sk1233/courses/codes-S16/lec4.pdf)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Concatenated code simple test](https://en.wikipedia.org/wiki/Concatenated_error_correction_code)

| Field | Value |
| --- | --- |
| `innerType` | hamming |
| `outerType` | repetition |
| `input` | `01000101` |
| `expected` | `000101000001010001010000010100010100000101` |

**Vector 2** — [Concatenated all zeros](https://en.wikipedia.org/wiki/Concatenated_error_correction_code)

| Field | Value |
| --- | --- |
| `innerType` | hamming |
| `outerType` | repetition |
| `input` | `00000000` |
| `expected` | `000000000000000000000000000000000000000000` |

---

[← All algorithms](../README.md)
