# Locally Recoverable Code

> Codes with locality property where each symbol can be recovered from small number of other symbols. Parameters [n,k,d,r] where r is locality. Used in distributed storage systems (Windows Azure Storage, Facebook's HDFS-RAID). Each coded symbol recoverable from at most r other symbols. Trade-off between rate, distance, and locality.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Locally Recoverable Code |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Dimitris S. Papailiopoulos, Alexandros G. Dimakis |
| Year | 2012 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/locally-recoverable-code.js`](../../../algorithms/ecc/locally-recoverable-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Locality-Distance Trade-off | Improving locality (smaller r) reduces minimum distance d, limiting global error correction. | — |
| Limited Error Correction | Small minimum distance limits number of correctable errors compared to MDS codes. | — |
| Repair Bandwidth | While repair is local, multiple failures may require non-local recovery operations. | — |

## Documentation

- [Microsoft Research Paper](https://www.microsoft.com/en-us/research/publication/locally-repairable-codes/)
- [Wikipedia - LRC](https://en.wikipedia.org/wiki/Locally_recoverable_code)
- [Error Correction Zoo](https://errorcorrectionzoo.org/c/lrc)

## References

- [Prakash et al. (ISIT 2012)](https://ieeexplore.ieee.org/document/6284206)
- [Azure Storage Architecture](https://sigops.org/s/conferences/sosp/2011/current/2011-Cascais/printable/11-calder.pdf)
- [Facebook HDFS-RAID](https://research.facebook.com/publications/hdfs-raid/)
- [Singleton-Type Bounds](https://arxiv.org/abs/1206.3804)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [LRC [6,3,3] all zeros vector](https://ieeexplore.ieee.org/document/6284206)

| Field | Value |
| --- | --- |
| `input` | `000000` |
| `expected` | `000000000000` |

**Vector 2** — [LRC [6,3,3] message [1,0,0] with locality r=2](https://www.microsoft.com/en-us/research/publication/locally-repairable-codes/)

| Field | Value |
| --- | --- |
| `input` | `010000` |
| `expected` | `010000010001` |

**Vector 3** — [LRC [6,3,3] message [0,1,0] with local parities](https://ieeexplore.ieee.org/document/6284206)

| Field | Value |
| --- | --- |
| `input` | `000100` |
| `expected` | `000100010101` |

**Vector 4** — [LRC [6,3,3] message [1,1,1] full pattern](https://arxiv.org/abs/1206.3804)

| Field | Value |
| --- | --- |
| `input` | `010101` |
| `expected` | `010101000001` |

---

[← All algorithms](../README.md)
