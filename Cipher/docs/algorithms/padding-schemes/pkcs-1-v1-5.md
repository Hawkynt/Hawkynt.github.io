# PKCS#1 v1.5

> PKCS#1 version 1.5 padding scheme for RSA encryption and digital signatures. Provides randomized padding for RSA operations to prevent certain cryptographic attacks. Used extensively in SSL/TLS and other cryptographic protocols.

## Properties

| Property | Value |
| --- | --- |
| Category | Padding Schemes |
| Sub-category | Asymmetric Padding |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | RSA Security Inc. |
| Year | 1991 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/padding/pkcs.js`](../../../algorithms/padding/pkcs.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsLengthIncluded` | No |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Padding Oracle Attack | PKCS#1 v1.5 is vulnerable to padding oracle attacks (Bleichenbacher's attack) if error messages distinguish between different types of padding failures. | — |
| Chosen Ciphertext Attack | Without proper implementation precautions, can be vulnerable to adaptive chosen ciphertext attacks. | — |
| Side Channel Attacks | Timing attacks may be possible if padding validation is not implemented in constant time. | — |

## Documentation

- [RFC 8017 - PKCS #1 v2.2](https://tools.ietf.org/rfc/rfc8017.txt)
- [RFC 2437 - PKCS #1 v2.0](https://tools.ietf.org/rfc/rfc2437.txt)
- [RSA Security PKCS #1](http://www.rsa.com/rsalabs/node.asp?id=2125)

## References

- [RSA Cryptography Standard](https://en.wikipedia.org/wiki/PKCS_1)
- [Padding Oracle Attacks](https://en.wikipedia.org/wiki/Padding_oracle_attack)
- [RSA Security](https://www.rsa.com/)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — PKCS#1 v1.5 encryption padding - 16-byte message

Source: Educational implementation

| Field | Value |
| --- | --- |
| `keySize` | `2048` |
| `paddingType` | encryption |
| `input` | `6bc1bee22e409f96e93d7e117393170a` |
| `expected` | `0002ffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffff00 6bc1bee22e409f96e93d7e117393170a` |

**Vector 2** — PKCS#1 v1.5 encryption padding - Hello World

Source: Educational implementation

| Field | Value |
| --- | --- |
| `keySize` | `2048` |
| `paddingType` | encryption |
| `input` | `48656c6c6f20576f726c64` |
| `expected` | `0002ffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffff0048656c6c6f20576f726c64` |

---

[← All algorithms](../README.md)
