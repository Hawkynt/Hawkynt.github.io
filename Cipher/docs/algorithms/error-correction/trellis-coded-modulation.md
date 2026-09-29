# Trellis Coded Modulation

> Joint coding and modulation achieving coding gain without bandwidth expansion. Combines convolutional encoding with signal constellation mapping using set partitioning. Invented by Gottfried Ungerboeck at IBM Zurich. Used in V.32/V.34 modems, digital satellite communications, and wireless systems. Viterbi decoding on trellis maximizes Euclidean distance between sequences.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Trellis Coded Modulation |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Gottfried Ungerboeck |
| Year | 1982 |
| Origin | 🇨🇭 Switzerland |
| Source | [`algorithms/ecc/trellis-coded-modulation.js`](../../../algorithms/ecc/trellis-coded-modulation.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Viterbi Complexity | Decoding complexity grows exponentially with number of trellis states. 4-state TCM is practical, but 64+ states become computationally intensive. | — |
| Channel Sensitivity | Performance depends on accurate channel estimation and soft-decision information. Hard-decision decoding significantly degrades performance. | — |
| Constellation Sensitivity | Set partitioning requires precise signal constellation mapping. Phase and amplitude errors degrade Euclidean distance properties. | — |

## Documentation

- [Wikipedia - Trellis Modulation](https://en.wikipedia.org/wiki/Trellis_modulation)
- [Error Correction Zoo - TCM](https://errorcorrectionzoo.org/c/trellis)
- [ITU-T Recommendation V.32](https://www.itu.int/rec/T-REC-V.32/en)
- [ITU-T Recommendation V.34](https://www.itu.int/rec/T-REC-V.34/en)

## References

- [Ungerboeck's Original Paper (1982)](https://ieeexplore.ieee.org/document/1456196)
- [Channel Coding with Multilevel/Phase Signals](https://doi.org/10.1109/TIT.1982.1056454)
- [Trellis-Coded Modulation with Redundant Signal Sets](https://ieeexplore.ieee.org/document/1094877)
- [Introduction to Trellis-Coded Modulation](https://web.stanford.edu/class/ee379a/handouts/lecture10.pdf)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [TCM 4-state 8-PSK: input 00 from state 0](https://ieeexplore.ieee.org/document/1456196)

| Field | Value |
| --- | --- |
| `input` | `0000` |
| `expected` | `000000` |

**Vector 2** — [TCM 4-state 8-PSK: input 01 from state 0](https://ieeexplore.ieee.org/document/1456196)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `000001` |

**Vector 3** — [TCM 4-state 8-PSK: input 10 from state 0](https://ieeexplore.ieee.org/document/1456196)

| Field | Value |
| --- | --- |
| `input` | `0100` |
| `expected` | `010100` |

**Vector 4** — [TCM 4-state 8-PSK: input 11 from state 0](https://ieeexplore.ieee.org/document/1456196)

| Field | Value |
| --- | --- |
| `input` | `0101` |
| `expected` | `010101` |

---

[← All algorithms](../README.md)
