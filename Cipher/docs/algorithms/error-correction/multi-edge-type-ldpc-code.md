# Multi-Edge Type LDPC Code

> Generalization of LDPC codes with multiple variable and check node types connected by different edge types. Each edge type has its own degree distribution enabling better optimization than standard LDPC. Used in DVB-S2X satellite broadcasting and 5G NR wireless standards. Spatially-coupled LDPC codes are a special case. Educational implementation demonstrates 2-edge type construction with per-type degree distributions.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Structured LDPC Code |
| Security status | 🧪 Experimental |
| Complexity | Expert |
| Inventor | Tom Richardson, Rüdiger Urbanke |
| Year | 2008 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/multi-edge-ldpc.js`](../../../algorithms/ecc/multi-edge-ldpc.js) |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Multi-Type Decoder Complexity | Managing multiple edge types requires separate message schedules and update rules for each type, increasing decoder complexity | — |
| Degree Distribution Optimization | Finding optimal degree distributions per edge type requires extensive density evolution analysis | — |
| Implementation Overhead | Multiple edge types increase memory requirements and routing complexity in hardware implementations | — |

## Documentation

- [Richardson&Urbanke - Modern Coding Theory](https://www.cambridge.org/core/books/modern-coding-theory/5D29BDA526321BF2566C5C879F577B0C)
- [Multi-Edge Type LDPC Codes Paper](http://wiiau4.free.fr/pdf/Multi-Edge%20Type%20LDPC%20Codes.pdf)
- [Error Correction Zoo - Multi-Edge LDPC](https://errorcorrectionzoo.org/c/multi_edge_ldpc)
- [DVB-S2X Standard (ETSI EN 302 307-2)](https://dvb.org/wp-content/uploads/2021/02/A083-2r2_DVB-S2X_Draft-EN-302-307-2-v131_Feb_2021.pdf)

## References

- [Richardson&Urbanke 2008 - Multi-Edge Type LDPC Codes](https://www.semanticscholar.org/paper/Multi-Edge-Type-LDPC-Codes-Richardson-Urbanke/27ed099a5e74d9eae71700a187d91fba648da2fd)
- [5G NR Channel Coding Overview](https://www.cambridge.org/core/journals/apsipa-transactions-on-signal-and-information-processing/article/an-overview-of-channel-coding-for-5g-nr-cellular-communications/CF52C26874AF5E00883E00B6E1F907C7)
- [Weight Distributions of Multi-Edge LDPC](https://arxiv.org/pdf/1009.1137)
- [LDPC Decoder for DVB-S2X Standards](https://ieeexplore.ieee.org/document/7345034/)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ME-LDPC all-zero codeword (2-edge type, rate 1/2)](http://wiiau4.free.fr/pdf/Multi-Edge%20Type%20LDPC%20Codes.pdf)

| Field | Value |
| --- | --- |
| `input` | `0000000000000000` |
| `expected` | `00000000000000000000000000000000` |

**Vector 2** — [ME-LDPC single-bit test - edge type 1](https://www.semanticscholar.org/paper/Multi-Edge-Type-LDPC-Codes-Richardson-Urbanke/27ed099a5e74d9eae71700a187d91fba648da2fd)

| Field | Value |
| --- | --- |
| `input` | `0100000000000000` |
| `expected` | _(empty)_ |

**Vector 3** — [ME-LDPC alternating pattern - demonstrating edge type interaction](https://arxiv.org/pdf/1009.1137)

| Field | Value |
| --- | --- |
| `input` | `0100010001000100` |
| `expected` | _(empty)_ |

**Vector 4** — [ME-LDPC block pattern - edge type 2 dominance](https://errorcorrectionzoo.org/c/multi_edge_ldpc)

| Field | Value |
| --- | --- |
| `input` | `0101010100000000` |
| `expected` | _(empty)_ |

**Vector 5** — [ME-LDPC all-ones information](https://ieeexplore.ieee.org/document/7345034/)

| Field | Value |
| --- | --- |
| `input` | `0101010101010101` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
