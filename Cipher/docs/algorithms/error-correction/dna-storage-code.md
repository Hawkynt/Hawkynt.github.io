# DNA Storage Code

> Error correction codes for DNA data storage using quaternary alphabet {A,C,G,T}. Implements Reed-Solomon over GF(4) with GC-content balancing and homopolymer avoidance. Used in molecular storage systems by Microsoft, Twist Bioscience, and academic researchers.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Quaternary Code |
| Security status | 🧪 Experimental |
| Complexity | Expert |
| Inventor | George Church, Sri Kosuri |
| Year | 2012 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/dna-storage-code.js`](../../../algorithms/ecc/dna-storage-code.js) |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Synthesis Error Sensitivity | DNA synthesis can introduce insertion, deletion, and substitution errors at rates of 0.1-1%. Multiple redundancy and error correction layers recommended. | — |
| Homopolymer Errors | Long runs of identical bases (AAA, TTT, GGG, CCC) are prone to sequencing errors. Constraint checking helps but cannot eliminate all risks. | — |
| GC Content Imbalance | Sequences outside 40-60% GC content may form secondary structures or fail synthesis. Encoding should maintain balance. | — |

## Documentation

- [DNA Data Storage](https://en.wikipedia.org/wiki/DNA_digital_data_storage)
- [Microsoft DNA Storage Project](https://www.microsoft.com/en-us/research/project/dna-storage/)
- [Reed-Solomon over GF(4)](https://math.stackexchange.com/questions/4322885/dna-storage-using-reed-solomon)

## References

- [Church et al. Science 2012](https://www.science.org/doi/10.1126/science.1226355)
- [Microsoft Nature Biotechnology 2016](https://www.nature.com/articles/nbt.3721)
- [Erlich and Zielinski Science 2017](https://www.science.org/doi/10.1126/science.aaj2038)
- [Organick et al. Nature Biotechnology 2018](https://www.nature.com/articles/nbt.4079)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RS(7,3) over GF(4) - All zeros](https://en.wikipedia.org/wiki/Reed%E2%80%93Solomon_error_correction)

| Field | Value |
| --- | --- |
| `input` | `000000` |
| `expected` | `00000000000000` |

**Vector 2** — [RS(7,3) over GF(4) - Pattern ACG](https://math.stackexchange.com/questions/4322885/dna-storage-using-reed-solomon)

| Field | Value |
| --- | --- |
| `input` | `000102` |
| `expected` | `00010202030103` |

**Vector 3** — [RS(7,3) over GF(4) - Maximum values TTT](https://errorcorrectionzoo.org/c/reed_solomon)

| Field | Value |
| --- | --- |
| `input` | `030303` |
| `expected` | `03030300030000` |

**Vector 4** — [RS(7,3) over GF(4) - Alternating CAT](https://en.wikipedia.org/wiki/Finite_field)

| Field | Value |
| --- | --- |
| `input` | `010003` |
| `expected` | `01000302020103` |

**Vector 5** — [RS(7,3) over GF(4) - GC-rich CGG](https://www.microsoft.com/en-us/research/project/dna-storage/)

| Field | Value |
| --- | --- |
| `input` | `010202` |
| `expected` | `01020203010300` |

**Vector 6** — [RS(7,3) encoding verification - GCA](https://www.nature.com/articles/nbt.3721)

| Field | Value |
| --- | --- |
| `input` | `020100` |
| `expected` | `02010002030301` |

---

[← All algorithms](../README.md)
