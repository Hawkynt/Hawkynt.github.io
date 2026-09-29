# SYSV-Checksum

> Unix System V checksum algorithm used by the 'sum' command. Simple sum of all bytes with modulo 32-bit arithmetic. Historical Unix utility for basic file integrity verification. Compatible with System V sum -s option.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Unix Utility |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | AT&T Bell Labs |
| Year | 1983 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/checksum/sysv-checksum.js`](../../../algorithms/checksum/sysv-checksum.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Algorithm: Sum all bytes, result mod 2^16
- Output: 16-bit checksum (0-65535)
- Used in: System V Unix 'sum -s' command
- Simple and fast but weak error detection
- Does not detect reordering of blocks
- Superseded by stronger checksums (CRC, MD5, SHA)
- Historical significance in Unix systems

## Documentation

- [sum Command Manual](https://man7.org/linux/man-pages/man1/sum.1.html)
- [Unix Checksum Algorithms](https://en.wikipedia.org/wiki/Sum_(Unix))
- [System V Documentation](https://docs.oracle.com/cd/E19253-01/816-5165/sum-1/index.html)

## References

- [GNU coreutils sum.c (sysv_sum_file) reference implementation](https://github.com/coreutils/coreutils/blob/master/src/sum.c)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Simple ASCII

Source: SYSV checksum

| Field | Value |
| --- | --- |
| `input` | `68656c6c6f` |
| `expected` | `0214` |

**Vector 2** — Single byte

Source: SYSV checksum

| Field | Value |
| --- | --- |
| `input` | `42` |
| `expected` | `0042` |

**Vector 3** — Multiple bytes

Source: SYSV checksum

| Field | Value |
| --- | --- |
| `input` | `01020304` |
| `expected` | `000a` |

---

[← All algorithms](../README.md)
