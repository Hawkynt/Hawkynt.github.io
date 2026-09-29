# XCBC-MAC

> Extended Cipher Block Chaining Message Authentication Code. Uses three derived keys with AES for cryptographic authentication.

## Properties

| Property | Value |
| --- | --- |
| Category | Message Authentication |
| Sub-category | XCBC |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | John Black, Phillip Rogaway |
| Year | 2000 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/mac/xcbc.js`](../../../algorithms/mac/xcbc.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| MAC sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `NeedsKey` | Yes |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 3566 - The AES-XCBC-MAC-96 Algorithm](https://tools.ietf.org/html/rfc3566)
- [Black and Rogaway - CBC MACs for Arbitrary-Length Messages](https://web.cs.ucdavis.edu/~rogaway/papers/3k.pdf)

## References

- [LibTomCrypt XCBC Implementation](https://github.com/libtom/libtomcrypt/tree/develop/src/mac/xcbc)
- [RFC 3566 Full Specification](https://datatracker.ietf.org/doc/html/rfc3566)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [LibTomCrypt Test Vector 1 - Empty Message](https://github.com/libtom/libtomcrypt/blob/develop/src/mac/xcbc/xcbc_test.c)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | _(empty)_ |
| `expected` | `75f0251d528ac01c4573dfd584d79f29` |

**Vector 2** — [LibTomCrypt Test Vector 2 - 3 bytes](https://github.com/libtom/libtomcrypt/blob/develop/src/mac/xcbc/xcbc_test.c)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102` |
| `expected` | `5b376580ae2f19afe7219ceef172756f` |

**Vector 3** — [LibTomCrypt Test Vector 3 - Single Block](https://github.com/libtom/libtomcrypt/blob/develop/src/mac/xcbc/xcbc_test.c)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `d2a246fa349b68a79998a4394ff7a263` |

**Vector 4** — [LibTomCrypt Test Vector 4 - Two Blocks](https://github.com/libtom/libtomcrypt/blob/develop/src/mac/xcbc/xcbc_test.c)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `f54f0ec8d2b9f3d36807734bd5283fd4` |

**Vector 5** — [LibTomCrypt Test Vector 5 - 34 bytes](https://github.com/libtom/libtomcrypt/blob/develop/src/mac/xcbc/xcbc_test.c)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 2021` |
| `expected` | `becbb3bccdb518a30677d5481fb6b4d8` |

---

[← All algorithms](../README.md)
