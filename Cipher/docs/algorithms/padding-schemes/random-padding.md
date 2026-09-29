# Random Padding

> Random padding scheme fills remaining bytes with random values to reach the block size. This provides some obfuscation of message length patterns but has serious ambiguity issues during padding removal, as there is no way to distinguish padding from actual data without additional length information.

## Properties

| Property | Value |
| --- | --- |
| Category | Padding Schemes |
| Sub-category | Random Padding |
| Security status | 🎓 Educational Only |
| Complexity | Not specified |
| Inventor | N/A |
| Year | 1970 |
| Origin | Not specified |
| Source | [`algorithms/padding/random.js`](../../../algorithms/padding/random.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsLengthIncluded` | No |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Ambiguous Padding Removal | Cannot distinguish between padding and actual data without external length information, making safe unpadding impossible. | — |
| Data Corruption Risk | High risk of data corruption during unpadding since any sequence of bytes could be considered padding. | — |
| Protocol Vulnerabilities | Unsuitable for modern protocols that require deterministic padding removal. | — |
| Entropy Requirements | Requires secure random number generation, which may not be available in all environments. | — |

## Documentation

- [Early Encryption Systems](https://en.wikipedia.org/wiki/History_of_cryptography)
- [Padding Problems](https://en.wikipedia.org/wiki/Padding_(cryptography)#Random_padding)
- [Modern Padding Standards](https://tools.ietf.org/rfc/rfc3852.txt)

## References

- [Cryptographic Engineering](https://cryptoengineering.org/)
- [Secure Padding Methods](https://csrc.nist.gov/publications/detail/sp/800-38a/final)
- [Historical Ciphers](https://en.wikipedia.org/wiki/Classical_cipher)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Self-computed regression vector - deterministic (zero-byte) padding example, real random padding output varies](https://en.wikipedia.org/wiki/Padding_(cryptography)#Random_padding)

| Field | Value |
| --- | --- |
| `isDeterministic` | Yes |
| `blockSize` | `32` |
| `originalLength` | `15` |
| `input` | `6bc1bee22e409f96e93d7e11739317` |
| `expected` | `6bc1bee22e409f96e93d7e117393170000000000000000000000000000000000` |

---

[← All algorithms](../README.md)
