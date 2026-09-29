# Sum-32

> 32-bit summation checksum. Adds all bytes and keeps only the lowest 32 bits. Good error detection for larger data blocks.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Summation |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Unknown |
| Year | 1970 |
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

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Simple sequence

Source: Sum32 calculation

| Field | Value |
| --- | --- |
| `input` | `01020304` |
| `expected` | `0000000a` |

---

[← All algorithms](../README.md)
