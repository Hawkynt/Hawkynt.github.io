# ANSI X9.23

> ANSI X9.23 padding scheme fills blocks with zero bytes except for the last byte, which indicates the padding length. This scheme is commonly used in financial cryptographic applications and provides a deterministic padding method suitable for block ciphers.

## Properties

| Property | Value |
| --- | --- |
| Category | Padding Schemes |
| Sub-category | Block Padding |
| Security status | 🛡️ Secure |
| Complexity | Not specified |
| Inventor | ANSI |
| Year | 1998 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/padding/ansi-x923.js`](../../../algorithms/padding/ansi-x923.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsLengthIncluded` | No |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Padding Oracle | Like other padding schemes, ANSI X9.23 can be vulnerable to padding oracle attacks if error messages reveal padding validity. | — |
| Length Disclosure | The padding scheme reveals information about the original message length modulo block size. | — |

## Documentation

- [ANSI X9.23 Standard](https://webstore.ansi.org/standards/ascx9/ansix9231998)
- [Financial Cryptographic Standards](https://x9.org/workproducts/)
- [Padding in Cryptography](https://en.wikipedia.org/wiki/Padding_(cryptography))

## References

- [ANSI X9 Committee](https://x9.org/)
- [Financial Services Cryptography](https://www.iso.org/committee/45144.html)
- [Block Cipher Padding](https://tools.ietf.org/rfc/rfc3852.txt)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — ANSI X9.23 padding with 17 bytes needed

Source: ANSI X9.23 Standard

| Field | Value |
| --- | --- |
| `blockSize` | `32` |
| `input` | `6bc1bee22e409f96e93d7e11739317` |
| `expected` | `6bc1bee22e409f96e93d7e117393170000000000000000000000000000000011` |

**Vector 2** — ANSI X9.23 padding with 18 bytes needed

Source: ANSI X9.23 Standard

| Field | Value |
| --- | --- |
| `blockSize` | `32` |
| `input` | `6bc1bee22e409f96e93d7e117393` |
| `expected` | `6bc1bee22e409f96e93d7e117393000000000000000000000000000000000012` |

**Vector 3** — ANSI X9.23 padding with 59 bytes needed

Source: ANSI X9.23 Standard

| Field | Value |
| --- | --- |
| `blockSize` | `64` |
| `input` | `6bc1bee22e` |
| `expected` | `6bc1bee22e0000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 0000000000000000000000000000003b` |

---

[← All algorithms](../README.md)
