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

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

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

**Vector 3** — [AES-128 GMAC - 20-byte message (node AES-128-GCM, empty plaintext)](https://nodejs.org/api/crypto.html#ciphersetaadbuffer-options)

| Field | Value |
| --- | --- |
| `key` | `010e1b2835424f5c697683909daab7c4` |
| `nonce` | `020f1c293643505d6a778491` |
| `input` | `03101d2a3744515e6b7885929facb9c6d3e0edfa` |
| `expected` | `be845653884a7a35f9d79b6fd26134cf` |

**Vector 4** — [AES-192 GMAC - 33-byte message (node AES-192-GCM, empty plaintext)](https://nodejs.org/api/crypto.html#ciphersetaadbuffer-options)

| Field | Value |
| --- | --- |
| `key` | `04111e2b3845525f6c798693a0adbac7d4e1eefb0815222f` |
| `nonce` | `05121f2c394653606d7a8794` |
| `input` | `0613202d3a4754616e7b8895a2afbcc9 d6e3f0fd0a1724313e4b5865727f8c99 a6` |
| `expected` | `4afc622c01f284717c67be13aa35456b` |

**Vector 5** — [AES-256 GMAC - 64-byte message (node AES-256-GCM, empty plaintext)](https://nodejs.org/api/crypto.html#ciphersetaadbuffer-options)

| Field | Value |
| --- | --- |
| `key` | `0714212e3b4855626f7c8996a3b0bdcad7e4f1fe0b1825323f4c596673808d9a` |
| `nonce` | `0815222f3c495663707d8a97` |
| `input` | `091623303d4a5764717e8b98a5b2bfcc d9e6f3000d1a2734414e5b6875828f9c a9b6c3d0ddeaf704111e2b3845525f6c 798693a0adbac7d4e1eefb0815222f3c` |
| `expected` | `43bd7ac4315954058dfc36d6e5e2d116` |

---

[← All algorithms](../README.md)
