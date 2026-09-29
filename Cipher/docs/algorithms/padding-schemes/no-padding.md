# No Padding

> No padding scheme requires that input data must be an exact multiple of the block size. This approach is used when the application ensures proper data alignment or when padding would interfere with the protocol. Commonly used with stream ciphers or when data is naturally block-aligned.

## Properties

| Property | Value |
| --- | --- |
| Category | Padding Schemes |
| Sub-category | No Padding |
| Security status | Not classified |
| Complexity | Not specified |
| Inventor | N/A |
| Year | 1970 |
| Origin | Not specified |
| Source | [`algorithms/padding/no-padding.js`](../../../algorithms/padding/no-padding.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsLengthIncluded` | No |

## Security

**Status:** not classified — treat as unverified.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| No Protection | No padding provides no protection against data length leakage or other attacks that padding schemes might mitigate. | — |
| Strict Requirements | Requires careful application design to ensure data is always properly block-aligned. | — |

## Documentation

- [Block Cipher Modes](https://csrc.nist.gov/publications/detail/sp/800-38a/final)
- [Cryptographic Standards](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines)
- [Padding in Cryptography](https://en.wikipedia.org/wiki/Padding_(cryptography))

## References

- [ECB Mode without Padding](https://en.wikipedia.org/wiki/Block_cipher_mode_of_operation#ECB)
- [Stream Cipher Usage](https://en.wikipedia.org/wiki/Stream_cipher)
- [Block Size Requirements](https://tools.ietf.org/rfc/rfc3852.txt)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — No padding for exact block size

Source: No padding specification

| Field | Value |
| --- | --- |
| `blockSize` | `16` |
| `input` | `6bc1bee22e409f96e93d7e117393172a` |
| `expected` | `6bc1bee22e409f96e93d7e117393172a` |

**Vector 2** — No padding for multiple blocks

Source: No padding specification

| Field | Value |
| --- | --- |
| `blockSize` | `16` |
| `input` | `6bc1bee22e409f96e93d7e117393172a6bc1bee22e409f96e93d7e117393172a` |
| `expected` | `6bc1bee22e409f96e93d7e117393172a6bc1bee22e409f96e93d7e117393172a` |

---

[← All algorithms](../README.md)
