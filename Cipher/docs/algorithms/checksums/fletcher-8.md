# Fletcher-8

> Fletcher-8 checksum for small data integrity checking in embedded systems Uses two 4-bit running sums with modulo 15 for enhanced error detection.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Simple Checksum |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | John G. Fletcher |
| Year | 1982 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/checksum/fletcher.js`](../../../algorithms/checksum/fletcher.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Not Cryptographically Secure | Use cryptographic hash functions (SHA-256, SHA-3) for security purposes | — |
| Collision Vulnerability | Use for error detection only, not for data integrity in security contexts | — |

## Documentation

- [Wikipedia - Fletcher's checksum](https://en.wikipedia.org/wiki/Fletcher%27s_checksum)
- [RFC 1146 - TCP Alternative Checksum Options](https://tools.ietf.org/rfc/rfc1146.txt)
- [Original Fletcher Paper](https://ieeexplore.ieee.org/document/1094155)

## References

- [Linux Kernel Fletcher Implementation](https://github.com/torvalds/linux/blob/master/lib/checksum.c)
- [BSD Socket Implementation](https://github.com/freebsd/freebsd-src/blob/main/sys/netinet/in_cksum.c)
- [Fletcher Checksum Analysis](https://www.zlib.net/tech_report_96.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty string](https://en.wikipedia.org/wiki/Fletcher%27s_checksum)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00` |

**Vector 2** — Single byte 'a'

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `77` |

**Vector 3** — String 'abc'

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `19` |

---

[← All algorithms](../README.md)
