# TLS-12-PRF(HMAC(SHA-384))

> TLS 1.2 Pseudorandom Function using HMAC-SHA-384. Modern TLS key derivation supporting arbitrary hash functions. Uses P_hash construction with single PRF instead of dual MD5+SHA-1.

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

**Vector 1** — [IETF TLS 1.2 SHA-384 Test Vector](https://www.ietf.org/mail-archive/web/tls/current/msg03416.html)

| Field | Value |
| --- | --- |
| `salt` | `cd665cf6a8447dd6ff8b27555edb7465` |
| `label` | `74657374206c6162656c` |
| `outputSize` | `148` |
| `input` | `b80b733d6ceefcdc71566ea48e5567df` |
| `expected` | `7b0c18e9ced410ed1804f2cfa34a336a 1c14dffb4900bb5fd7942107e81c83cd e9ca0faa60be9fe34f82b1233c9146a0 e534cb400fed2700884f9dc236f80edd 8bfa961144c9e8d792eca722a7b32fc3 d416d473ebc2c5fd4abfdad05d918425 9b5bf8cd4d90fa0d31e2dec479e4f1a2 6066f2eea9a69236a3e52655c9e9aee6 91c8f3a26854308d5eaa3be85e099070 3d73e56f` |

---

[← All algorithms](../README.md)
