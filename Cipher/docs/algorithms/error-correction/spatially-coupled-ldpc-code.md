# Spatially Coupled LDPC Code

> Convolutional-like LDPC codes achieving capacity on binary erasure channel with bounded complexity through spatial coupling. Chain-like coupling structure with threshold saturation to Shannon limit. Used in optical communications and 5G research.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Capacity-Achieving Code |
| Security status | 🧪 Experimental |
| Complexity | Expert |
| Inventor | Michael Lentmaier, Arvind Sridharan, Kamil Zigangirov |
| Year | 2010 |
| Origin | 🇸🇪 Sweden |
| Source | [`algorithms/ecc/spatially-coupled-ldpc.js`](../../../algorithms/ecc/spatially-coupled-ldpc.js) |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Windowed Decoding Complexity | Sliding window decoding requires careful management of window size and update strategy for practical implementation | — |
| Boundary Effects | Termination of finite-length chains can degrade performance at boundaries; requires proper termination strategy | — |
| Memory Requirements | Spatially coupled structure requires storage of multiple code sections for windowed processing | — |

## Documentation

- [Error Correction Zoo - SC-LDPC](https://errorcorrectionzoo.org/c/sc_ldpc)
- [Spatially Coupled LDPC Codes from Protographs](https://arxiv.org/abs/1407.5366)
- [Threshold Saturation Overview](https://ieeexplore.ieee.org/document/6912949/)

## References

- [Lentmaier et al. IEEE Trans. IT 2010](https://ieeexplore.ieee.org/document/5571031)
- [Kudekar et al. Threshold Saturation 2011](https://ieeexplore.ieee.org/document/5942938)
- [Spatially Coupled LDPC Construction](https://www.researchgate.net/publication/264122887_Spatially_Coupled_LDPC_Codes_Constructed_from_Protographs)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SC-LDPC all-zero encoding test - L=3, w=2](https://errorcorrectionzoo.org/c/sc_ldpc)

| Field | Value |
| --- | --- |
| `input` | `000000` |
| `expected` | `000000000000` |

**Vector 2** — [SC-LDPC single-bit encoding test - (3,6) protograph](https://errorcorrectionzoo.org/c/sc_ldpc)

| Field | Value |
| --- | --- |
| `input` | `010000` |
| `expected` | `010000010001` |

**Vector 3** — [SC-LDPC pattern encoding test - threshold saturation](https://errorcorrectionzoo.org/c/sc_ldpc)

| Field | Value |
| --- | --- |
| `input` | `010100` |
| `expected` | `010100000101` |

**Vector 4** — [SC-LDPC alternating pattern test](https://errorcorrectionzoo.org/c/sc_ldpc)

| Field | Value |
| --- | --- |
| `input` | `010001` |
| `expected` | `010001000000` |

---

[← All algorithms](../README.md)
