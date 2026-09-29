# GMAC

> Galois Message Authentication Code as defined in NIST SP 800-38D. Authentication component of GCM mode using Galois Field arithmetic.

## Properties

| Property | Value |
| --- | --- |
| Category | Message Authentication |
| Sub-category | GMAC |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | NIST |
| Year | 2007 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/mac/gmac.js`](../../../algorithms/mac/gmac.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| MAC sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `NeedsKey` | Yes |
| `NeedsNonce` | Yes |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST SP 800-38D - GCM Specification](https://csrc.nist.gov/publications/detail/sp/800-38d/final)
- [RFC 5288 - AES Galois Counter Mode](https://tools.ietf.org/html/rfc5288)

## References

- [Intel PCLMULQDQ Instruction](https://software.intel.com/content/www/us/en/develop/articles/intel-carry-less-multiplication-instruction-and-its-usage-for-computing-the-gcm-mode.html)
- [Bouncy Castle GCM/GMAC](https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/modes/gcm)
- [OpenSSL GMAC Implementation](https://github.com/openssl/openssl/blob/master/crypto/modes/gcm128.c)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Botan Test Vector 1 - Empty input](https://github.com/randombit/botan/blob/master/src/tests/data/mac/gmac.vec)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `nonce` | `000000000000000000000000` |
| `input` | _(empty)_ |
| `expected` | `58e2fccefa7e3061367f1d57a4e7455a` |

**Vector 2** — [Botan Test Vector 2 - 16-byte zero input](https://github.com/randombit/botan/blob/master/src/tests/data/mac/gmac.vec)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `nonce` | `000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `21c2eb20cd2214dbdf34c9b82ecb7ed2` |

---

[← All algorithms](../README.md)
