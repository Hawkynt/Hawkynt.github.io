# Sum-8

> Simple 8-bit summation checksum. Adds all bytes and keeps only the lowest 8 bits (modulo 256). Fast and lightweight, commonly used in embedded systems.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Summation |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Unknown (fundamental technique) |
| Year | 1950 |
| Origin | Not specified |
| Source | [`algorithms/checksum/sum-checksum.js`](../../../algorithms/checksum/sum-checksum.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Checksum Algorithms](https://en.wikipedia.org/wiki/Checksum)
- [Sum Checksums Explained](https://stackoverflow.com/questions/71162153/)

## References

- [GNU coreutils sum.c reference implementation](https://github.com/coreutils/coreutils/blob/master/src/sum.c)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Simple sequence

Source: Sum8 calculation

| Field | Value |
| --- | --- |
| `input` | `01020304` |
| `expected` | `0a` |

**Vector 2** — Overflow test

Source: Sum8 with overflow

| Field | Value |
| --- | --- |
| `input` | `ffff` |
| `expected` | `fe` |

---

[← All algorithms](../README.md)
