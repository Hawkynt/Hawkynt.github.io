# Repeat-Accumulate Code

> Capacity-approaching code using repeat-interleave-accumulate construction. Serial concatenation of repetition code with differential encoder (mod-2 accumulator). Used in DVB-RCS satellite standard. Simple construction achieving near-Shannon limit performance with iterative decoding.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Concatenated Code |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Dariush Divsalar, Hui Jin, Robert J. McEliece |
| Year | 1998 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/repeat-accumulate-code.js`](../../../algorithms/ecc/repeat-accumulate-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Not Asymptotically Good | RA codes do not maintain constant rate and minimum distance as block length increases. Subject to upper bounds on minimum distance. | — |
| Decoding Complexity | Iterative belief propagation decoding requires significant computation. Performance depends on interleaver quality and iteration count. | — |
| Error Floor | May exhibit error floor at high SNR due to low-weight codewords. Interleaver design critical for performance. | — |

## Documentation

- [Wikipedia - Repeat-Accumulate Code](https://en.wikipedia.org/wiki/Repeat-accumulate_code)
- [Error Correction Zoo - RA Code](https://errorcorrectionzoo.org/c/ra)
- [MacKay - Information Theory, Inference and Learning](http://www.inference.org.uk/mackay/itila/)
- [DVB-RCS Standard Overview](https://www.etsi.org/technologies/satellite)

## References

- [Divsalar et al. - Coding Theorems for Turbo-Like Codes (1998)](https://tmo.jpl.nasa.gov/progress_report2/)
- [MacKay, Neal - Near Shannon Limit Performance](https://www.inference.org.uk/mackay/abstracts/ldpc.html)
- [Jin et al. - Irregular RA Codes (2000)](https://ieeexplore.ieee.org/document/1377999/)
- [DVB-RCS Specifications](https://www.etsi.org/deliver/etsi_en/301700_301799/301790/)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RA code all zeros - K=2 q=3 seed=42](https://errorcorrectionzoo.org/c/ra)

| Field | Value |
| --- | --- |
| `input` | `0000` |
| `expected` | `000000000000` |

**Vector 2** — [RA code pattern 10 - K=2 q=3 seed=42](https://errorcorrectionzoo.org/c/ra)

| Field | Value |
| --- | --- |
| `input` | `0100` |
| `expected` | `010100000101` |

**Vector 3** — [RA code pattern 01 - K=2 q=3 seed=42](https://errorcorrectionzoo.org/c/ra)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `000101000001` |

**Vector 4** — [RA code pattern 11 - K=2 q=3 seed=42](https://errorcorrectionzoo.org/c/ra)

| Field | Value |
| --- | --- |
| `input` | `0101` |
| `expected` | `010001000100` |

**Vector 5** — [RA code pattern 101 - K=3 q=3 seed=42](https://errorcorrectionzoo.org/c/ra)

| Field | Value |
| --- | --- |
| `input` | `010001` |
| `expected` | `010100010101000100` |

---

[← All algorithms](../README.md)
