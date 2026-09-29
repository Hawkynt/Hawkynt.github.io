# Sum-16

> 16-bit summation checksum. Adds all bytes and keeps only the lowest 16 bits (modulo 65536). Better error detection than Sum-8.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Summation |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Unknown |
| Year | 1960 |
| Origin | Not specified |
| Source | [`algorithms/checksum/sum-checksum.js`](../../../algorithms/checksum/sum-checksum.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Checksum Algorithms](https://en.wikipedia.org/wiki/Checksum)

## References

- [GNU coreutils sum.c reference implementation](https://github.com/coreutils/coreutils/blob/master/src/sum.c)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Simple sequence

Source: Sum16 calculation

| Field | Value |
| --- | --- |
| `input` | `01020304` |
| `expected` | `000a` |

**Vector 2** — Multi-byte sum

Source: Sum16 test

| Field | Value |
| --- | --- |
| `input` | `ffffff` |
| `expected` | `02fd` |

---

[← All algorithms](../README.md)
