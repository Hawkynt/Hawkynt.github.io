# TLS-12-PRF(HMAC(SHA-512))

> TLS 1.2 Pseudorandom Function using HMAC-SHA-512. Modern TLS key derivation supporting arbitrary hash functions. Uses P_hash construction with single PRF instead of dual MD5+SHA-1.

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

**Vector 1** — [IETF TLS 1.2 SHA-512 Test Vector](https://www.ietf.org/mail-archive/web/tls/current/msg03416.html)

| Field | Value |
| --- | --- |
| `salt` | `d4640e12e4bcdbfb437f03e6ae418ee5` |
| `label` | `74657374206c6162656c` |
| `outputSize` | `196` |
| `input` | `b0323523c1853599584d88568bbb05eb` |
| `expected` | `1261f588c798c5c201ff036e7a9cb5ed cd7fe3f94c669a122a4638d7d508b283 042df6789875c7147e906d868bc75c45 e20eb40c1cf4a1713b27371f68432592 f7dc8ea8ef223e12ea8507841311bf68 653d0cfc4056d811f025c45ddfa6e6fe c702f054b409d6f28dd0a3233e498da4 1a3e75c5630eedbe22fe254e33a1b0e9 f6b9826675bec7d01a845658dc9c3975 45401d40b9f46c7a400ee1b8f81ca0a6 0d1a397a1028bff5d2ef5066126842fb 8da4197632bdb54ff6633f86bbc836e6 40d4d898` |

---

[← All algorithms](../README.md)
