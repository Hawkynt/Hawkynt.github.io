# Adler-64

> Adler-64 checksum for high-performance applications and large datasets Uses two 32-bit running sums with modulo 4294967291 for fast error detection.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Simple Checksum |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
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

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `0000000000000001` |

**Vector 2** — Single byte 'a'

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `0000006200000062` |

**Vector 3** — Large data sample

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | `6c61726765206461746120696e746567 7269747920766572696669636174696f 6e` |
| `expected` | `0000d65600000ce8` |

---

[← All algorithms](../README.md)
