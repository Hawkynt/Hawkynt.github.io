# ARIA-Wrap

> ARIA Key Wrap algorithm following RFC 3394 structure. Securely wraps cryptographic keys using ARIA block cipher with authenticated encryption properties.

## Properties

| Property | Value |
| --- | --- |
| Category | Special Algorithms |
| Sub-category | Key Wrapping |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | NIST (algorithm structure), Korean Agency for Technology and Standards (ARIA cipher) |
| Year | 2004 |
| Origin | 🇰🇷 South Korea |
| Source | [`algorithms/crypto/ariawrap.js`](../../../algorithms/crypto/ariawrap.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 8 bytes |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 3394 - AES Key Wrap Algorithm (structure)](https://tools.ietf.org/html/rfc3394)
- [RFC 5794 - ARIA Encryption Algorithm](https://tools.ietf.org/html/rfc5794)
- [NIST Key Wrap Specification](https://csrc.nist.gov/projects/key-management/key-wrap)

## References

- [BouncyCastle ARIAWrapEngine](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/ARIAWrapEngine.java)
- [RFC 3394 Implementation Guide](https://tools.ietf.org/html/rfc3394)
- [ARIA Algorithm Specification](https://tools.ietf.org/html/rfc5794)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ARIA-128 Key Wrap - 128-bit Key Data](https://tools.ietf.org/html/rfc3394)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `a93f148d4909d85f1aae656909879275ae597b3acf9d60db` |

**Vector 2** — [ARIA-192 Key Wrap - 128-bit Key Data](https://tools.ietf.org/html/rfc3394)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `62c0cc597cea0a97c1ddfd9384ba51a9f4ec7aac30f7cedc` |

**Vector 3** — [ARIA-256 Key Wrap - 128-bit Key Data](https://tools.ietf.org/html/rfc3394)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `1f68ac246e2519b0235e1474867b08f606bcf85bef006eba` |

**Vector 4** — [ARIA-128 Key Wrap - 192-bit Key Data](https://tools.ietf.org/html/rfc3394)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00112233445566778899aabbccddeeff0001020304050607` |
| `expected` | `07f372824d4c9aafffd45f628c5aa433328624051b249ec9fe10c4d49ab5ff8f` |

**Vector 5** — [ARIA-128 Key Wrap - 256-bit Key Data](https://tools.ietf.org/html/rfc3394)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00112233445566778899aabbccddeeff000102030405060708090a0b0c0d0e0f` |
| `expected` | `a5d920a3169b4934f2f4f3d03de0c9f3 3eff79590e1f8b9de4653eca2d8c5edb 72bed41ec44d800e` |

---

[← All algorithms](../README.md)
