# TLS-12-PRF(HMAC(SHA-256))

> TLS 1.2 Pseudorandom Function using HMAC-SHA-256. Modern TLS key derivation supporting arbitrary hash functions. Uses P_hash construction with single PRF instead of dual MD5+SHA-1.

## Properties

| Property | Value |
| --- | --- |
| Category | Key Derivation Functions |
| Sub-category | Key Derivation Function |
| Security status | 🛡️ Secure |
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

**Status:** 🛡️ Secure

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

**Vector 1** — [IETF TLS 1.2 SHA-256 Test Vector](https://www.ietf.org/mail-archive/web/tls/current/msg03416.html)

| Field | Value |
| --- | --- |
| `salt` | `a0ba9f936cda311827a6f796ffd5198c` |
| `label` | `74657374206c6162656c` |
| `outputSize` | `100` |
| `input` | `9bbe436ba940f017b17652849a71db35` |
| `expected` | `e3f229ba727be17b8d122620557cd453 c2aab21d07c3d495329b52d4e61edb5a 6b301791e90d35c9c9a46b4e14baf9af 0fa022f7077def17abfd3797c0564bab 4fbc91666e9def9b97fce34f796789ba a48082d122ee42c5a72e5a5110fff701 87347b66` |

---

[← All algorithms](../README.md)
