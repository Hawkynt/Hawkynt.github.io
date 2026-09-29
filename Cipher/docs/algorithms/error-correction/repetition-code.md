# Repetition Code

> Simplest error correction code that repeats each bit n times. Decoding uses majority voting to recover the original bit. Can correct up to floor((n-1)/2) errors per codeword. Very low code rate but simple implementation.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Block Code |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Unknown (Fundamental Concept) |
| Year | 1940 |
| Origin | Not specified |
| Source | [`algorithms/ecc/repetition-code.js`](../../../algorithms/ecc/repetition-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Very Low Code Rate | For n=3 repetition, code rate is only 1/3, wasting significant bandwidth. | — |
| Limited Error Correction | Can only correct minority errors. If majority of bits are corrupted, decoding fails. | — |

## Documentation

- [Wikipedia - Repetition Code](https://en.wikipedia.org/wiki/Repetition_code)
- [Error Correction Zoo](https://errorcorrectionzoo.org/c/repetition)
- [MIT Lecture Notes](https://web.mit.edu/6.02/www/f2011/handouts/7.pdf)

## References

- [Majority Logic Decoding](https://en.wikipedia.org/wiki/Majority_logic_decoding)
- [Code Rate Analysis](https://www.sciencedirect.com/topics/computer-science/repetition-code)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Repetition (3,1) bit 0](https://en.wikipedia.org/wiki/Repetition_code)

| Field | Value |
| --- | --- |
| `repetitions` | `3` |
| `input` | `00` |
| `expected` | `000000` |

**Vector 2** — [Repetition (3,1) bit 1](https://en.wikipedia.org/wiki/Repetition_code)

| Field | Value |
| --- | --- |
| `repetitions` | `3` |
| `input` | `01` |
| `expected` | `010101` |

**Vector 3** — [Repetition (3,1) multi-bit](https://en.wikipedia.org/wiki/Repetition_code)

| Field | Value |
| --- | --- |
| `repetitions` | `3` |
| `input` | `010001` |
| `expected` | `010101000000010101` |

**Vector 4** — [Repetition (5,1) bit 1](https://en.wikipedia.org/wiki/Repetition_code)

| Field | Value |
| --- | --- |
| `repetitions` | `5` |
| `input` | `01` |
| `expected` | `0101010101` |

---

[← All algorithms](../README.md)
