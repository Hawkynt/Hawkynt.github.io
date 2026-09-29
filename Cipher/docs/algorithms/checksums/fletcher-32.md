# Fletcher-32

> Fletcher-32 checksum providing robust error detection for medium-sized data Uses two 16-bit running sums with modulo 65535 for enhanced error detection.

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

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty string](https://en.wikipedia.org/wiki/Fletcher%27s_checksum)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte 'a'](https://en.wikipedia.org/wiki/Fletcher%27s_checksum)

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `00610061` |

**Vector 3** — [String 'abcde' - published test vector, odd length so the last word is zero-padded](https://en.wikipedia.org/wiki/Fletcher%27s_checksum)

| Field | Value |
| --- | --- |
| `input` | `6162636465` |
| `expected` | `f04fc729` |

**Vector 4** — [String 'abcdef' - published test vector, exact multiple of the 16-bit word](https://en.wikipedia.org/wiki/Fletcher%27s_checksum)

| Field | Value |
| --- | --- |
| `input` | `616263646566` |
| `expected` | `56502d2a` |

**Vector 5** — [String 'abcdefgh' - published test vector](https://en.wikipedia.org/wiki/Fletcher%27s_checksum)

| Field | Value |
| --- | --- |
| `input` | `6162636465666768` |
| `expected` | `ebe19591` |

---

[← All algorithms](../README.md)
