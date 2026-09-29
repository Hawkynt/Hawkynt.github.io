# ISO/IEC 7816-4

> ISO/IEC 7816-4 padding scheme appends a single '1' bit (0x80 byte) followed by zero bits to fill the block. This method is designed for smart card communication and provides unambiguous padding removal. It is identical to bit padding and is widely used in cryptographic protocols.

## Properties

| Property | Value |
| --- | --- |
| Category | Padding Schemes |
| Sub-category | Smart Card Padding |
| Security status | 🛡️ Secure |
| Complexity | Not specified |
| Inventor | ISO/IEC |
| Year | 2005 |
| Origin | Not specified |
| Source | [`algorithms/padding/iso7816-4.js`](../../../algorithms/padding/iso7816-4.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsLengthIncluded` | No |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| None Known | ISO/IEC 7816-4 padding provides unambiguous padding removal with no known cryptographic weaknesses. | — |
| Length Expansion | Always adds at least one byte of padding, which increases data size even for complete blocks. | — |

## Documentation

- [ISO/IEC 7816-4 Standard](https://www.iso.org/standard/77180.html)
- [Smart Card Communication](https://en.wikipedia.org/wiki/ISO/IEC_7816)
- [Padding in Cryptography](https://en.wikipedia.org/wiki/Padding_(cryptography))

## References

- [ISO/IEC 7816 Series](https://www.iso.org/committee/45144.html)
- [Smart Card Standards](https://cardwerk.com/smart-card-standard-iso14443-type-a/)
- [Cryptographic Padding Methods](https://tools.ietf.org/rfc/rfc3852.txt)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — ISO 7816-4 padding with 17 bytes needed

Source: ISO/IEC 7816-4

| Field | Value |
| --- | --- |
| `blockSize` | `32` |
| `input` | `6bc1bee22e409f96e93d7e11739317` |
| `expected` | `6bc1bee22e409f96e93d7e117393178000000000000000000000000000000000` |

**Vector 2** — ISO 7816-4 padding for half block

Source: ISO/IEC 7816-4

| Field | Value |
| --- | --- |
| `blockSize` | `32` |
| `input` | `6bc1bee22e409f96e93d7e117393172a` |
| `expected` | `6bc1bee22e409f96e93d7e117393172a80000000000000000000000000000000` |

**Vector 3** — ISO 7816-4 padding with 3 bytes needed

Source: ISO/IEC 7816-4

| Field | Value |
| --- | --- |
| `blockSize` | `8` |
| `input` | `6bc1bee22e` |
| `expected` | `6bc1bee22e800000` |

---

[← All algorithms](../README.md)
