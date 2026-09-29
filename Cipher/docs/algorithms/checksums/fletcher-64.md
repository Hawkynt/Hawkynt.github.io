# Fletcher-64

> Fletcher-64 checksum for large datasets and high-performance applications Uses two 32-bit running sums with modulo 4294967295 for enhanced error detection.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Simple Checksum |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
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

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Empty string

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `0000000000000000` |

**Vector 2** — [String 'abcde' - published test vector, last 32-bit word zero-padded](https://en.wikipedia.org/wiki/Fletcher%27s_checksum)

| Field | Value |
| --- | --- |
| `input` | `6162636465` |
| `expected` | `c8c6c527646362c6` |

**Vector 3** — [String 'abcdef' - published test vector](https://en.wikipedia.org/wiki/Fletcher%27s_checksum)

| Field | Value |
| --- | --- |
| `input` | `616263646566` |
| `expected` | `c8c72b276463c8c6` |

**Vector 4** — [String 'abcdefgh' - published test vector, exact multiple of the 32-bit word](https://en.wikipedia.org/wiki/Fletcher%27s_checksum)

| Field | Value |
| --- | --- |
| `input` | `6162636465666768` |
| `expected` | `312e2b28cccac8c6` |

---

[← All algorithms](../README.md)
