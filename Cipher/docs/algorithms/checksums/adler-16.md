# Adler-16

> Adler-16 checksum for lightweight error detection in embedded systems Uses two 8-bit running sums with modulo 251 for fast error detection.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Simple Checksum |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Mark Adler |
| Year | 1995 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/checksum/adler.js`](../../../algorithms/checksum/adler.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Not Cryptographically Secure | Use cryptographic hash functions (SHA-256, SHA-3) for security purposes | — |
| Weak for Short Messages | Adler checksums can have poor distribution for very short inputs | — |
| Zero Byte Weakness | Sequences of zero bytes can produce predictable patterns | — |

## Documentation

- [RFC 1950 - ZLIB Compressed Data Format](https://tools.ietf.org/rfc/rfc1950.txt)
- [Adler-32 Algorithm Description](https://en.wikipedia.org/wiki/Adler-32)
- [zlib Library Documentation](https://zlib.net/manual.html)

## References

- [zlib Source Code](https://github.com/madler/zlib)
- [Adler-32 in Compression](https://tools.ietf.org/rfc/rfc1951.txt)
- [Performance Analysis](https://create.stephan-brumme.com/crc32/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Empty string

Source: RFC 1950 style - empty gives base value

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `0001` |

**Vector 2** — Single byte 'a'

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `6262` |

**Vector 3** — String 'abc'

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `572c` |

---

[← All algorithms](../README.md)
