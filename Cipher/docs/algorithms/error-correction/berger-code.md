# Berger Code

> Optimal unidirectional error detection code that detects all errors where bits flip in only one direction (all 0→1 or all 1→0). Encodes data by appending binary count of zeros in the information word. Uses ⌈log₂(k+1)⌉ check bits for k data bits. Widely used in fault-tolerant digital systems and delay-insensitive circuits.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Unidirectional Error Detection |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Jay M. Berger |
| Year | 1961 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/berger-code.js`](../../../algorithms/ecc/berger-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Bidirectional Errors Not Detected | Cannot detect errors where both 0→1 and 1→0 flips occur in the same codeword. Only detects purely unidirectional errors. | — |
| Detection Only - No Correction | Berger codes can only detect unidirectional errors, not correct them. Use for detection in asymmetric channels. | — |

## Documentation

- [Wikipedia - Berger Code](https://en.wikipedia.org/wiki/Berger_code)
- [Error Correction Zoo](https://errorcorrectionzoo.org/c/berger)
- [Unidirectional Error Detection](https://link.springer.com/chapter/10.1007/3-540-54303-1_122)

## References

- [Berger's Original Paper (1961)](https://www.sciencedirect.com/science/article/pii/S0019995861904996)
- [Self Checking Register File Using Berger Code](https://citeseerx.ist.psu.edu/document?repid=rep1&type=pdf&doi=c48d4280c718452a6849b781fbdf1ef63cd756ca)
- [Modified Berger Codes - IEEE](https://ieeexplore.ieee.org/document/1676484)
- [Burst and Unidirectional Error Detecting Codes](https://ieeexplore.ieee.org/document/146689/)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Berger (12,8) all zeros - count=8](https://en.wikipedia.org/wiki/Berger_code)

| Field | Value |
| --- | --- |
| `input` | `0000000000000000` |
| `expected` | `000000000000000001000000` |

**Vector 2** — [Berger (12,8) all ones - count=0](https://en.wikipedia.org/wiki/Berger_code)

| Field | Value |
| --- | --- |
| `input` | `0101010101010101` |
| `expected` | `010101010101010100000000` |

**Vector 3** — [Berger (12,8) pattern 11010100 - count=4](https://citeseerx.ist.psu.edu/document?repid=rep1&type=pdf&doi=c48d4280c718452a6849b781fbdf1ef63cd756ca)

| Field | Value |
| --- | --- |
| `input` | `0101000100010000` |
| `expected` | `010100010001000000010000` |

**Vector 4** — [Berger (12,8) pattern 00001111 - count=4](https://citeseerx.ist.psu.edu/document?repid=rep1&type=pdf&doi=c48d4280c718452a6849b781fbdf1ef63cd756ca)

| Field | Value |
| --- | --- |
| `input` | `0000000001010101` |
| `expected` | `000000000101010100010000` |

**Vector 5** — [Berger (12,8) pattern 10101010 - count=4](https://en.wikipedia.org/wiki/Berger_code)

| Field | Value |
| --- | --- |
| `input` | `0100010001000100` |
| `expected` | `010001000100010000010000` |

**Vector 6** — [Berger (12,8) pattern 01010101 - count=4](https://en.wikipedia.org/wiki/Berger_code)

| Field | Value |
| --- | --- |
| `input` | `0001000100010001` |
| `expected` | `000100010001000100010000` |

**Vector 7** — [Berger (12,8) single one - count=7](https://en.wikipedia.org/wiki/Berger_code)

| Field | Value |
| --- | --- |
| `input` | `0000000000000001` |
| `expected` | `000000000000000100010101` |

**Vector 8** — [Berger (12,8) single zero - count=1](https://en.wikipedia.org/wiki/Berger_code)

| Field | Value |
| --- | --- |
| `input` | `0101010101010100` |
| `expected` | `010101010101010000000001` |

---

[← All algorithms](../README.md)
