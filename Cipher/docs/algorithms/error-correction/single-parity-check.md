# Single Parity Check

> Simplest error correction code adding single parity bit to detect odd number of errors. Parameters (n, n-1, 2) giving code rate (n-1)/n. Can detect single-bit errors but cannot correct them. Dual of repetition code. Used in RAM, network packets (Ethernet CRC), serial communications. Extremely efficient for error detection.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Linear Code |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Unknown (classical technique) |
| Year | 1948 |
| Origin | Not specified |
| Source | [`algorithms/ecc/single-parity-check.js`](../../../algorithms/ecc/single-parity-check.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Cannot Correct Errors | Can only detect odd number of errors, cannot correct any errors. Even number of errors goes undetected. | — |
| Minimum Distance 2 | With d=2, can only detect single-bit errors, not correct them. | — |

## Documentation

- [Wikipedia - Parity Bit](https://en.wikipedia.org/wiki/Parity_bit)
- [Single Parity Check](https://www.tutorialspoint.com/single-parity-check)
- [Error Detection](https://www.cs.cornell.edu/courses/cs6114/2018sp/Handouts/Lec2.pdf)

## References

- [SPC in Communications](https://ieeexplore.ieee.org/document/10106461)
- [Soft-Decision Decoding](https://digital-library.theiet.org/doi/10.1049/el%3A19971092)
- [Concatenated FEC](https://arxiv.org/abs/2212.10523)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SPC (5,4) all zeros](https://en.wikipedia.org/wiki/Parity_bit)

| Field | Value |
| --- | --- |
| `input` | `00000000` |
| `expected` | `0000000000` |

**Vector 2** — [SPC (5,4) all ones](https://en.wikipedia.org/wiki/Parity_bit)

| Field | Value |
| --- | --- |
| `input` | `01010101` |
| `expected` | `0101010100` |

**Vector 3** — [SPC (5,4) pattern 1010](https://en.wikipedia.org/wiki/Parity_bit)

| Field | Value |
| --- | --- |
| `input` | `01000100` |
| `expected` | `0100010000` |

**Vector 4** — [SPC (5,4) pattern 1011](https://en.wikipedia.org/wiki/Parity_bit)

| Field | Value |
| --- | --- |
| `input` | `01000101` |
| `expected` | `0100010101` |

---

[← All algorithms](../README.md)
