# Zero Padding

> Zero padding scheme fills remaining bytes with zero values to reach the block size. This is the simplest padding method but has ambiguity issues when the original data ends with zero bytes, making it impossible to distinguish padding from actual data during removal. Such input is rejected rather than padded, because unpadding would silently return short data.

## Properties

| Property | Value |
| --- | --- |
| Category | Padding Schemes |
| Sub-category | Simple Padding |
| Security status | 🎓 Educational Only |
| Complexity | Not specified |
| Inventor | N/A |
| Year | 1970 |
| Origin | Not specified |
| Restricted input domain | data whose last byte is not zero |
| Source | [`algorithms/padding/zero.js`](../../../algorithms/padding/zero.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsLengthIncluded` | No |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Ambiguous Padding Removal | Cannot distinguish between padding zeros and actual data zeros, leading to potential data corruption during unpadding. | — |
| Data Loss Risk | If original data ends with zeros, those zeros will be incorrectly removed during unpadding. | — |
| Protocol Vulnerabilities | The ambiguity can be exploited in certain protocols where message length matters. | — |

## Documentation

- [ISO/IEC 9797-1](https://www.iso.org/standard/31136.html)
- [Padding Ambiguity Issues](https://en.wikipedia.org/wiki/Padding_(cryptography)#Zero_padding)
- [Block Cipher Padding](https://tools.ietf.org/rfc/rfc3852.txt)

## References

- [Cryptographic Padding Methods](https://csrc.nist.gov/publications/detail/sp/800-38a/final)
- [Block Cipher Modes](https://en.wikipedia.org/wiki/Block_cipher_mode_of_operation)
- [ISO Standards](https://www.iso.org/committee/45144.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Zero padding with 17 bytes needed

Source: Zero padding specification

| Field | Value |
| --- | --- |
| `blockSize` | `32` |
| `input` | `6bc1bee22e409f96e93d7e11739317` |
| `expected` | `6bc1bee22e409f96e93d7e117393170000000000000000000000000000000000` |

**Vector 2** — Zero padding for exact block size

Source: Zero padding specification

| Field | Value |
| --- | --- |
| `blockSize` | `16` |
| `input` | `6bc1bee22e409f96e93d7e117393172a` |
| `expected` | `6bc1bee22e409f96e93d7e117393172a` |

**Vector 3** — Zero padding with 3 bytes needed

Source: Zero padding specification

| Field | Value |
| --- | --- |
| `blockSize` | `8` |
| `input` | `6bc1bee22e` |
| `expected` | `6bc1bee22e000000` |

---

[← All algorithms](../README.md)
