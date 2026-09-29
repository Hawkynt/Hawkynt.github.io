# Even Weight Code

> Code where all codewords have even Hamming weight (even number of 1s). Equivalent to single parity check code. Parameters (n, n-1, 2) with minimum distance 2. Can detect single-bit errors. Used in Type I self-dual codes and error detection. Dual of repetition code of length n.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Linear Code |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Unknown (classical technique) |
| Year | 1950 |
| Origin | Not specified |
| Source | [`algorithms/ecc/even-weight-code.js`](../../../algorithms/ecc/even-weight-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Detection Only | Can only detect errors, not correct them. Minimum distance d=2 insufficient for correction. | — |
| Even Error Blindness | Cannot detect even number of errors (e.g., 2, 4, 6 bit errors). | — |

## Documentation

- [Wikipedia - Hamming Weight](https://en.wikipedia.org/wiki/Hamming_weight)
- [Even Weight Codes](https://www.sciencedirect.com/topics/mathematics/self-dual-code)
- [Self-Dual Codes](https://errorcorrectionzoo.org/c/self_dual)

## References

- [Type I Self-Dual](https://en.wikipedia.org/wiki/Dual_code)
- [Weight Properties](https://mathworld.wolfram.com/Error-CorrectingCode.html)
- [Constant Weight Codes](https://en.wikipedia.org/wiki/Constant-weight_code)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Even Weight (6,5) all zeros](https://en.wikipedia.org/wiki/Hamming_weight)

| Field | Value |
| --- | --- |
| `input` | `0000000000` |
| `expected` | `000000000000` |

**Vector 2** — [Even Weight (6,5) pattern 10000](https://en.wikipedia.org/wiki/Hamming_weight)

| Field | Value |
| --- | --- |
| `input` | `0100000000` |
| `expected` | `010000000001` |

**Vector 3** — [Even Weight (6,5) pattern 11000](https://en.wikipedia.org/wiki/Hamming_weight)

| Field | Value |
| --- | --- |
| `input` | `0101000000` |
| `expected` | `010100000000` |

**Vector 4** — [Even Weight (6,5) pattern 10101](https://en.wikipedia.org/wiki/Hamming_weight)

| Field | Value |
| --- | --- |
| `input` | `0100010001` |
| `expected` | `010001000101` |

---

[← All algorithms](../README.md)
