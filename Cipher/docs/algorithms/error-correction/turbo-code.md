# Turbo Code

> Parallel concatenated convolutional codes with iterative decoding. First practical codes to closely approach Shannon limit. Used in 3G/4G mobile communications. Two recursive systematic convolutional encoders separated by interleaver. Iterative MAP/SOVA decoding with extrinsic information exchange.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Concatenated Code |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Claude Berrou, Alain Glavieux, Punya Thitimajshima |
| Year | 1993 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/ecc/turbo-code.js`](../../../algorithms/ecc/turbo-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Decoding Complexity | Iterative MAP/SOVA decoding requires significant computational resources. Complexity increases with frame length and iteration count. | — |
| Decoding Latency | Iterative decoding introduces latency proportional to iteration count. Critical for real-time applications. | — |
| Error Floor | Low error floors may occur at high SNR due to low-weight codewords. Mitigated by interleaver design. | — |

## Documentation

- [Wikipedia - Turbo Code](https://en.wikipedia.org/wiki/Turbo_code)
- [3GPP TS 36.212 - LTE Multiplexing and Channel Coding](https://www.3gpp.org/ftp/Specs/archive/36_series/36.212/)
- [Turbo Code Tutorial](https://www.mathworks.com/help/comm/ug/turbo-encoder.html)
- [NASA Turbo Code Overview](https://tmo.jpl.nasa.gov/progress_report/42-154/154F.pdf)

## References

- [Original 1993 ICC Paper](https://ieeexplore.ieee.org/document/264935)
- [Berrou et al. - Near Shannon Limit Error-Correcting Coding](https://doi.org/10.1109/ICC.1993.264935)
- [3GPP LTE Physical Layer Specification](https://www.3gpp.org/ftp/Specs/archive/36_series/36.211/)
- [Iterative Decoding Survey](https://ieeexplore.ieee.org/document/910577)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Turbo code all zeros - K=4 rate 1/3](https://www.3gpp.org/ftp/Specs/archive/36_series/36.212/)

| Field | Value |
| --- | --- |
| `input` | `00000000` |
| `expected` | `000000000000000000000000` |

**Vector 2** — [Turbo code single bit - K=4 rate 1/3](https://www.3gpp.org/ftp/Specs/archive/36_series/36.212/)

| Field | Value |
| --- | --- |
| `input` | `01000000` |
| `expected` | `010101000101000000000101` |

**Vector 3** — [Turbo code pattern 1100 - K=4 rate 1/3](https://ieeexplore.ieee.org/document/264935)

| Field | Value |
| --- | --- |
| `input` | `01010000` |
| `expected` | `010101010001000101000100` |

**Vector 4** — [Turbo code alternating - K=4 rate 1/3](https://ieeexplore.ieee.org/document/264935)

| Field | Value |
| --- | --- |
| `input` | `01000100` |
| `expected` | `010101000100010101000001` |

---

[← All algorithms](../README.md)
