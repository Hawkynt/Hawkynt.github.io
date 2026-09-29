# BSD-Checksum

> BSD Unix checksum algorithm using rotating 16-bit sum. Rotates checksum right by 1 bit before adding each byte. Used by BSD 'sum' command for file integrity verification.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Rotating Sum |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | BSD Unix developers |
| Year | 1977 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/checksum/bsd-checksum.js`](../../../algorithms/checksum/bsd-checksum.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Algorithm: rotate right, then add byte
- Rotation provides better bit mixing than simple sum
- Used in BSD Unix 'sum' command
- Better error detection than simple sum
- 16-bit result provides reasonable collision resistance
- Formula: rotate right by 1 bit, add byte, mask to 16 bits

## Documentation

- [BSD Checksum Algorithm](https://en.wikipedia.org/wiki/BSD_checksum)
- [Unix sum Command](https://man.freebsd.org/cgi/man.cgi?query=sum)
- [Checksum Comparison](https://www.gnu.org/software/coreutils/manual/html_node/sum-invocation.html)

## References

- [GNU coreutils sum.c (bsd_sum_stream)](https://github.com/coreutils/coreutils/blob/master/src/sum.c)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Single character

Source: BSD checksum calculation

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `0061` |

**Vector 2** — Three characters

Source: BSD checksum with rotation

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `40ac` |

**Vector 3** — Maximum bytes

Source: BSD checksum overflow handling

| Field | Value |
| --- | --- |
| `input` | `ffff` |
| `expected` | `817e` |

---

[← All algorithms](../README.md)
