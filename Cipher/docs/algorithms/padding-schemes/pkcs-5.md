# PKCS#5

> PKCS#5 padding scheme is designed specifically for 8-byte block ciphers like DES. Each padding byte contains the number of padding bytes added. This is essentially identical to PKCS#7 but restricted to 8-byte blocks only. It was developed for password-based encryption systems.

## Properties

| Property | Value |
| --- | --- |
| Category | Padding Schemes |
| Sub-category | Password-Based Padding |
| Security status | 🛡️ Secure |
| Complexity | Not specified |
| Inventor | RSA Laboratories |
| Year | 1993 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/padding/pkcs.js`](../../../algorithms/padding/pkcs.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsLengthIncluded` | No |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Padding Oracle Attack | Like PKCS#7, PKCS#5 can be vulnerable to padding oracle attacks if error messages reveal padding validity. | — |
| Block Size Limitation | PKCS#5 is restricted to 8-byte blocks only, limiting its applicability to modern ciphers. | — |
| Legacy Cipher Usage | Primarily used with DES, which is now considered cryptographically broken. | — |

## Documentation

- [RFC 2898 - PKCS #5](https://tools.ietf.org/rfc/rfc2898.txt)
- [Password-Based Cryptography](https://www.rsa.com/en-us/company/standards)
- [PKCS Standards](https://en.wikipedia.org/wiki/PKCS)

## References

- [RSA Laboratories](https://www.rsa.com/)
- [DES Encryption](https://csrc.nist.gov/publications/detail/fips/46-3/archive/1999-10-25)
- [Password-Based Encryption](https://tools.ietf.org/rfc/rfc8018.txt)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — PKCS#5 padding with 3 bytes needed

Source: RFC 2898

| Field | Value |
| --- | --- |
| `blockSize` | `8` |
| `input` | `6bc1bee22e` |
| `expected` | `6bc1bee22e030303` |

**Vector 2** — PKCS#5 padding for full block

Source: RFC 2898

| Field | Value |
| --- | --- |
| `blockSize` | `8` |
| `input` | `6bc1bee22e409f96` |
| `expected` | `6bc1bee22e409f960808080808080808` |

**Vector 3** — PKCS#5 padding with 7 bytes needed

Source: RFC 2898

| Field | Value |
| --- | --- |
| `blockSize` | `8` |
| `input` | `6bc1bee22e409f96e9` |
| `expected` | `6bc1bee22e409f96e907070707070707` |

---

[← All algorithms](../README.md)
