# LRC Pyramid Code

> Hierarchical locally recoverable code with pyramid structure used in Microsoft Azure Storage. 12+2+2 configuration with local parity groups enabling fast single-failure recovery and global parity for multiple failures. Reduces I/O for repairs compared to Reed-Solomon while optimizing bandwidth versus reliability trade-off.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Locally Recoverable Code |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Cheng Huang, Huseyin Simitci, Yikang Xu |
| Year | 2012 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/lrc-pyramid-code.js`](../../../algorithms/ecc/lrc-pyramid-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Limited Global Error Correction | With only 2 global parities, can only correct up to 2 erasures beyond local group capacity. Multiple failures in different groups may exceed correction capability. | — |
| Local Group Dependency | If both symbols in a local parity group fail along with the local parity, local recovery is impossible and requires global reconstruction. | — |
| Bandwidth Trade-off | While reducing I/O for single failures, still requires significant bandwidth for multiple concurrent failures affecting multiple local groups. | — |

## Documentation

- [Erasure Coding in Windows Azure Storage (USENIX ATC 2012)](https://www.usenix.org/conference/atc12/technical-sessions/presentation/huang)
- [Microsoft Research - Azure Storage Paper](https://www.microsoft.com/en-us/research/publication/erasure-coding-in-windows-azure-storage/)
- [Pyramid Codes Paper (IEEE NCA 2007)](https://www.microsoft.com/en-us/research/publication/pyramid-codes-flexible-schemes-to-trade-space-for-access-efficiency-in-reliable-data-storage-systems/)

## References

- [USENIX ATC 2012 Full Paper](https://www.usenix.org/system/files/conference/atc12/atc12-final181_0.pdf)
- [Pyramid Codes (Huang, Chen, Li 2007)](https://www.semanticscholar.org/paper/Pyramid-Codes:-Flexible-Schemes-to-Trade-Space-for-Huang-Chen/7b33d4fe4909d758f9f3647c954a8c58a80fdc4c)
- [LRC Theory Paper](https://arxiv.org/abs/1206.3804)
- [GitHub Reference Implementation](https://github.com/drmingdrmer/lrc-erasure-code)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [LRC Pyramid (12,2,2) all zeros](https://www.usenix.org/conference/atc12/technical-sessions/presentation/huang)

| Field | Value |
| --- | --- |
| `input` | `000000000000000000000000` |
| `expected` | `00000000000000000000000000000000` |

**Vector 2** — [LRC Pyramid (12,2,2) single data block in first local group](https://www.microsoft.com/en-us/research/publication/erasure-coding-in-windows-azure-storage/)

| Field | Value |
| --- | --- |
| `input` | `010000000000000000000000` |
| `expected` | `01000000000000000000000001000101` |

**Vector 3** — [LRC Pyramid (12,2,2) single data block in second local group](https://www.usenix.org/system/files/conference/atc12/atc12-final181_0.pdf)

| Field | Value |
| --- | --- |
| `input` | `000000000000010000000000` |
| `expected` | `00000000000001000000000000010107` |

**Vector 4** — [LRC Pyramid (12,2,2) alternating pattern](https://www.microsoft.com/en-us/research/publication/erasure-coding-in-windows-azure-storage/)

| Field | Value |
| --- | --- |
| `input` | `010001000100010001000100` |
| `expected` | `01000100010001000100010001010002` |

**Vector 5** — [LRC Pyramid (12,2,2) full ones pattern](https://www.usenix.org/conference/atc12/technical-sessions/presentation/huang)

| Field | Value |
| --- | --- |
| `input` | `010101010101010101010101` |
| `expected` | `0101010101010101010101010000000c` |

**Vector 6** — [LRC Pyramid (12,2,2) mixed values testing local and global parities](https://www.microsoft.com/en-us/research/publication/pyramid-codes-flexible-schemes-to-trade-space-for-access-efficiency-in-reliable-data-storage-systems/)

| Field | Value |
| --- | --- |
| `input` | `0503070204060801090b0d0f` |
| `expected` | `0503070204060801090b0d0f01090806` |

---

[← All algorithms](../README.md)
