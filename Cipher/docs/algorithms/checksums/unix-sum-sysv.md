# Unix-Sum-SYSV

> SYSV checksum using simple summation with order-independent calculation Classic Unix sum(1) algorithm for basic file integrity verification.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Legacy Checksum |
| Security status | Not classified |
| Complexity | Beginner |
| Inventor | Bell Labs |
| Year | 1971 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/checksum/unix-sum.js`](../../../algorithms/checksum/unix-sum.js) |

## Security

**Status:** not classified — treat as unverified.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Cryptographically Insecure | Trivially broken - use for compatibility only, never for security | — |
| Weak Error Detection | Poor error detection compared to CRC - many collisions possible | — |
| Predictable Output | Output can be easily predicted and manipulated by attackers | — |

## Documentation

- [Unix sum(1) manual](https://man7.org/linux/man-pages/man1/sum.1.html)
- [BSD Checksum Algorithm](https://en.wikipedia.org/wiki/BSD_checksum)
- [SYSV Checksum Algorithm](https://en.wikipedia.org/wiki/SYSV_checksum)

## References

- [Unix History](https://www.unix.org/what_is_unix/history_timeline.html)
- [BSD vs SYSV Comparison](https://www.unix.com/man-page/FreeBSD/1/sum/)
- [Legacy Checksum Analysis](https://www.openwall.com/lists/oss-security/)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Empty string

Source: SYSV sum(1) standard test

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `0000` |

**Vector 2** — Single byte 'a'

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `0061` |

**Vector 3** — String 'abc'

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `0126` |

**Vector 4** — Standard test phrase

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | `0fd9` |

---

[← All algorithms](../README.md)
