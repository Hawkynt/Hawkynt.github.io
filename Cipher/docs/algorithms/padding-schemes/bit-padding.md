# Bit Padding

> Bit padding scheme appends a single '1' bit (0x80 byte) followed by zero bits to fill the block. This method provides unambiguous padding removal and is commonly used in hash functions and cryptographic protocols. Also known as ISO/IEC 7816-4 padding.

## Properties

| Property | Value |
| --- | --- |
| Category | Padding Schemes |
| Sub-category | Bit Padding |
| Security status | 🛡️ Secure |
| Complexity | Not specified |
| Inventor | Merkle-Damgård |
| Year | 1979 |
| Origin | Not specified |
| Source | [`algorithms/padding/bit-padding.js`](../../../algorithms/padding/bit-padding.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsLengthIncluded` | No |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| None Known | Bit padding provides unambiguous padding removal with no known cryptographic weaknesses. | — |
| Length Expansion | Always adds at least one byte of padding, which may be undesirable for some applications. | — |

## Documentation

- [Merkle-Damgård Construction](https://en.wikipedia.org/wiki/Merkle%E2%80%93Damg%C3%A5rd_construction)
- [ISO/IEC 7816-4](https://www.iso.org/standard/77180.html)
- [Padding in Cryptography](https://en.wikipedia.org/wiki/Padding_(cryptography))

## References

- [Hash Function Design](https://csrc.nist.gov/publications/detail/fips/180/4/final)
- [Smart Card Standards](https://www.iso.org/committee/45144.html)
- [Cryptographic Padding Methods](https://tools.ietf.org/rfc/rfc3852.txt)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Bit padding with 17 bytes needed

Source: ISO/IEC 7816-4

| Field | Value |
| --- | --- |
| `blockSize` | `32` |
| `input` | `6bc1bee22e409f96e93d7e11739317` |
| `expected` | `6bc1bee22e409f96e93d7e117393178000000000000000000000000000000000` |

**Vector 2** — Bit padding for full block

Source: ISO/IEC 7816-4

| Field | Value |
| --- | --- |
| `blockSize` | `32` |
| `input` | `6bc1bee22e409f96e93d7e117393172a` |
| `expected` | `6bc1bee22e409f96e93d7e117393172a80000000000000000000000000000000` |

**Vector 3** — Bit padding with 3 bytes needed

Source: ISO/IEC 7816-4

| Field | Value |
| --- | --- |
| `blockSize` | `8` |
| `input` | `6bc1bee22e` |
| `expected` | `6bc1bee22e800000` |

---

[← All algorithms](../README.md)
