# Hsiao Code

> Optimized SEC-DED code with minimum odd-weight columns for energy efficiency. Uses syndrome parity to distinguish single from double errors. Widely used in ECC memory and cache protection.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Linear Code |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Ming-Yao (M. Y.) Hsiao |
| Year | 1970 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/hsiao-code.js`](../../../algorithms/ecc/hsiao-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Double Error Detection Only | Can detect but not correct double-bit errors. Uses syndrome parity to identify error type. | — |
| Triple Error Miscorrection | Triple errors may be miscorrected as single errors if syndrome parity appears odd. | — |

## Documentation

- [Hsiao's Original Paper](http://people.eecs.berkeley.edu/~culler/cs252-s02/papers/hsiao70.pdf)
- [ArXiv - Hsiao Check Matrices](https://arxiv.org/abs/0803.1217)
- [IEEE Paper](https://ieeexplore.ieee.org/document/6177346/)

## References

- [ECC Memory Systems](https://www.sciencedirect.com/topics/computer-science/error-correction-code)
- [Hsiao Code Implementations](https://www.researchgate.net/publication/221520382)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Hsiao (8,4) all zeros](http://people.eecs.berkeley.edu/~culler/cs252-s02/papers/hsiao70.pdf)

| Field | Value |
| --- | --- |
| `input` | `00000000` |
| `expected` | `0000000000000000` |

**Vector 2** — [Hsiao (8,4) all ones](http://people.eecs.berkeley.edu/~culler/cs252-s02/papers/hsiao70.pdf)

| Field | Value |
| --- | --- |
| `input` | `01010101` |
| `expected` | `0101010101010101` |

**Vector 3** — [Hsiao (8,4) pattern test](http://people.eecs.berkeley.edu/~culler/cs252-s02/papers/hsiao70.pdf)

| Field | Value |
| --- | --- |
| `input` | `01000100` |
| `expected` | `0001000101000100` |

---

[← All algorithms](../README.md)
