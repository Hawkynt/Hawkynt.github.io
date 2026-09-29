# TLS-12-PRF(HMAC(SHA-224))

> TLS 1.2 Pseudorandom Function using HMAC-SHA-224. Modern TLS key derivation supporting arbitrary hash functions. Uses P_hash construction with single PRF instead of dual MD5+SHA-1.

## Properties

| Property | Value |
| --- | --- |
| Category | Key Derivation Functions |
| Sub-category | Key Derivation Function |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | IETF TLS Working Group |
| Year | 2008 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/kdf/tls-prf.js`](../../../algorithms/kdf/tls-prf.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 1 byte (8 bits) to 1024 bytes (8192 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SaltRequired` | Yes |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 5246 - TLS 1.2 Protocol](https://tools.ietf.org/rfc/rfc5246.txt)
- [Botan TLS-12-PRF Implementation](https://github.com/randombit/botan/blob/master/src/lib/kdf/prf_tls/prf_tls.cpp)
- [IETF Mail Archive - Test Vectors](https://www.ietf.org/mail-archive/web/tls/current/msg03416.html)

## References

- [OpenSSL TLS1.2 PRF](https://github.com/openssl/openssl/blob/master/ssl/t1_enc.c)
- [RFC 8446 - TLS 1.3](https://tools.ietf.org/rfc/rfc8446.txt)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [IETF TLS 1.2 SHA-224 Test Vector](https://www.ietf.org/mail-archive/web/tls/current/msg03416.html)

| Field | Value |
| --- | --- |
| `salt` | `f5a3fe6d34e2e28560fdcaf6823f9091` |
| `label` | `74657374206c6162656c` |
| `outputSize` | `88` |
| `input` | `e18828740352b530d69b34c6597dea2e` |
| `expected` | `224d8af3c0453393a9779789d21cf7da 5ee62ae6b617873d489428efc8dd58d1 566e7029e2ca3a5ecd355dc64d4d927e 2fbd78c4233e8604b14749a77a92a70f ddf614bc0df623d798604e4ca5512794 d802a258e82f86cf` |

---

[← All algorithms](../README.md)
