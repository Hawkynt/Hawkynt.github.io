# Polar Code

> First capacity-achieving codes with explicit construction. Provably achieve Shannon channel capacity for symmetric binary-input discrete memoryless channels. Adopted in 5G NR for control channels (PBCH, PDCCH, PUCCH). Based on channel polarization phenomenon where independent copies of a channel are combined to produce extremal channels. Successive cancellation decoding provides efficient implementation.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Linear Code |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Erdal Arıkan |
| Year | 2008 |
| Origin | 🌐 International |
| Source | [`algorithms/ecc/polar-code.js`](../../../algorithms/ecc/polar-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Finite-Length Performance | Polar codes require large blocklengths to approach capacity; short blocklengths show performance gap | — |
| Decoding Latency | Successive cancellation decoding is inherently sequential, leading to higher latency compared to parallel decoders | — |
| Construction Complexity | Optimal frozen bit selection requires channel knowledge and complex construction algorithms | — |

## Documentation

- [Wikipedia - Polar Code](https://en.wikipedia.org/wiki/Polar_code_(coding_theory))
- [Error Correction Zoo - Polar Code](https://errorcorrectionzoo.org/c/polar)
- [3GPP TS 38.212 - 5G NR Polar Codes](https://www.3gpp.org/DynaReport/38212.htm)
- [MathWorks - 5G Polar Coding](https://www.mathworks.com/help/5g/gs/polar-coding.html)

## References

- [Arıkan's Original Paper (2008)](https://arxiv.org/abs/0807.3917)
- [Channel Polarization IEEE Paper](https://ieeexplore.ieee.org/document/5075875)
- [5G Polar Code Performance](https://ieeexplore.ieee.org/document/8936409)
- [Duke University - Polar Codes Tutorial](http://pfister.ee.duke.edu/courses/ecen655/polar.pdf)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Polar (8,4) all-zero codeword](https://en.wikipedia.org/wiki/Polar_code_(coding_theory))

| Field | Value |
| --- | --- |
| `input` | `00000000` |
| `expected` | `0000000000000000` |

**Vector 2** — [Polar (8,4) all-one codeword from single info bit](https://en.wikipedia.org/wiki/Polar_code_(coding_theory))

| Field | Value |
| --- | --- |
| `input` | `00000001` |
| `expected` | `0101010101010101` |

**Vector 3** — [Polar (8,4) single info bit at position 3](https://en.wikipedia.org/wiki/Polar_code_(coding_theory))

| Field | Value |
| --- | --- |
| `input` | `01000000` |
| `expected` | `0100010001000100` |

**Vector 4** — [Polar (8,4) single info bit at position 5](https://en.wikipedia.org/wiki/Polar_code_(coding_theory))

| Field | Value |
| --- | --- |
| `input` | `00010000` |
| `expected` | `0101000001010000` |

**Vector 5** — [Polar (8,4) two info bits pattern](https://en.wikipedia.org/wiki/Polar_code_(coding_theory))

| Field | Value |
| --- | --- |
| `input` | `01000001` |
| `expected` | `0001000100010001` |

---

[← All algorithms](../README.md)
