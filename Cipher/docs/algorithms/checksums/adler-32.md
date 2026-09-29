# Adler-32

> Adler-32 checksum used in zlib, gzip and other compression formats Uses two 16-bit running sums with modulo 65521 for fast error detection.

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

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Empty string

Source: RFC 1950 - empty string gives 1

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000001` |

**Vector 2** — Single byte 'a'

Source: RFC 1950 test vector

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `00620062` |

**Vector 3** — String 'abc'

Source: RFC 1950 test vector

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `024d0127` |

**Vector 4** — String 'message digest'

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | `6d65737361676520646967657374` |
| `expected` | `29750586` |

**Vector 5** — Alphabet string

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | `6162636465666768696a6b6c6d6e6f707172737475767778797a` |
| `expected` | `90860b20` |

---

[← All algorithms](../README.md)
