# PSS

> Probabilistic Signature Scheme (PSS) padding for RSA signatures as defined in PKCS#1 v2.1. Provides provable security and resistance to signature forgery attacks. Uses randomization and a mask generation function for enhanced security. PSS is a one-way encoding, not a reversible padding: the encoded message contains H = Hash(padding || messageHash || salt) and never the message hash itself, so PKCS#1 defines EMSA-PSS-VERIFY - which recomputes H from a message the caller already holds and reports consistent or inconsistent - and defines no decode operation. The inverse direction here therefore verifies the structure of the encoded message and returns the recovered H; it does not and cannot reproduce the input.

## Properties

| Property | Value |
| --- | --- |
| Category | Padding Schemes |
| Sub-category | Signature Padding |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Mihir Bellare, Phillip Rogaway |
| Year | 1996 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/padding/pss.js`](../../../algorithms/padding/pss.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsLengthIncluded` | No |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Implementation Errors | Incorrect implementation of MGF1 or salt handling can compromise security. | — |
| Side Channel Attacks | Timing or power analysis attacks may be possible with naive implementations. | — |
| Salt Reuse | Using the same salt for multiple signatures can reveal information. | — |

## Documentation

- [RFC 8017 - PKCS #1 v2.2 PSS](https://tools.ietf.org/rfc/rfc8017.txt)
- [PKCS #1 v2.1 Standard](https://www.rsa.com/rsalabs/node.asp?id=2125)
- [PSS Original Paper](https://cseweb.ucsd.edu/~mihir/papers/pss.pdf)

## References

- [RSA-PSS Wikipedia](https://en.wikipedia.org/wiki/Probabilistic_signature_scheme)
- [MGF1 Mask Generation](https://tools.ietf.org/rfc/rfc3447.txt)
- [Cryptography Engineering](https://www.schneier.com/books/cryptography_engineering/)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — PSS padding with 11-byte input

Source: Educational implementation

| Field | Value |
| --- | --- |
| `keySize` | `2048` |
| `saltLength` | `20` |
| `hashFunction` | SHA-1 |
| `input` | `48656c6c6f20576f726c64` |
| `expected` | `4c7e44412ff1f63ebb446bc23e89347c 50f4120b4c7e44432ff1f63ebb446bc2 3e89347c50f4120b4c7e44452ff1f63e bb446bc23e89347c50f4120b4c7e4447 2ff1f63ebb446bc23e89347c50f4120b 4c7e44492ff1f63ebb446bc23e89347c 50f4120b4c7e444b2ff1f63ebb446bc2 3e89347c50f4120b4c7e444d2ff1f63e bb446bc23e89347c50f4120b4c7e444f 2ff1f63ebb446bc23e89347c50f4120b 4c7e44512ff1f63ebb446bc23e89347c 50f4120b4c7e44532ff1f63ebb446bc2 3e89347c50f4120b4c7e44552ff1f63e bb446bc23e8935561f808bb5af766905 586d37d8b0743eb8a14dddc5844ef358 a09b762c58376a8cd8be139d44cfcabc` |

**Vector 2** — PSS padding with 20-byte SHA-1 hash

Source: Educational implementation

| Field | Value |
| --- | --- |
| `keySize` | `2048` |
| `saltLength` | `20` |
| `hashFunction` | SHA-1 |
| `input` | `000102030405060708090a0b0c0d0e0f10111213` |
| `expected` | `c155e9eec927c1488c28ce44b3efcb62 b411b4fcc155e9ecc927c1488c28ce44 b3efcb62b411b4fcc155e9eac927c148 8c28ce44b3efcb62b411b4fcc155e9e8 c927c1488c28ce44b3efcb62b411b4fc c155e9e6c927c1488c28ce44b3efcb62 b411b4fcc155e9e4c927c1488c28ce44 b3efcb62b411b4fcc155e9e2c927c148 8c28ce44b3efcb62b411b4fcc155e9e0 c927c1488c28ce44b3efcb62b411b4fc c155e9fec927c1488c28ce44b3efcb62 b411b4fcc155e9fcc927c1488c28ce44 b3efcb62b411b4fcc155e9fac927c148 8c28ce44b3efca48fb652d42225dc4aa bebb00ae87189b3e2c2b22a64e25182b cb004db76ee5294aeb411cefb69c31bc` |

---

[← All algorithms](../README.md)
