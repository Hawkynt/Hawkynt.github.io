# scrypt

> Sequential memory-hard key derivation function designed to resist brute-force attacks using specialized hardware. Uses large memory requirements to prevent time-memory trade-offs.

## Properties

| Property | Value |
| --- | --- |
| Category | Key Derivation Functions |
| Sub-category | Memory-Hard KDF |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | Colin Percival |
| Year | 2009 |
| Origin | 🇨🇦 Canada |
| Source | [`algorithms/kdf/scrypt.js`](../../../algorithms/kdf/scrypt.js) |

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

- [RFC 7914 - The scrypt Password-Based Key Derivation Function](https://tools.ietf.org/html/rfc7914)
- [Stronger Key Derivation via Sequential Memory-Hard Functions](https://www.tarsnap.com/scrypt/scrypt.pdf)
- [Salsa20 Specification](https://cr.yp.to/snuffle/spec.pdf)

## References

- [OpenSSL EVP_PBE_scrypt](https://github.com/openssl/openssl/blob/master/crypto/kdf/scrypt.c)
- [Python Cryptography scrypt](https://cryptography.io/en/latest/hazmat/primitives/key-derivation-functions/#scrypt)
- [Node.js crypto.scrypt](https://nodejs.org/api/crypto.html#crypto_crypto_scrypt_password_salt_keylen_options_callback)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 7914 Test Vector 1 - Empty password and salt](https://datatracker.ietf.org/doc/html/rfc7914#section-12)

| Field | Value |
| --- | --- |
| `salt` | _(empty)_ |
| `N` | `16` |
| `r` | `1` |
| `p` | `1` |
| `keyLength` | `64` |
| `input` | _(empty)_ |
| `expected` | `77d6576238657b203b19ca42c18a0497 f16b4844e3074ae8dfdffa3fede21442 fcd0069ded0948f8326a753a0fc81f17 e8d3e0fb2e0d3628cf35e20c38d18906` |

**Vector 2** — [RFC 7914 Test Vector 2 - password/NaCl](https://datatracker.ietf.org/doc/html/rfc7914#section-12)

| Field | Value |
| --- | --- |
| `salt` | `4e61436c` |
| `N` | `1024` |
| `r` | `8` |
| `p` | `16` |
| `keyLength` | `64` |
| `input` | `70617373776f7264` |
| `expected` | `fdbabe1c9d3472007856e7190d01e9fe 7c6ad7cbc8237830e77376634b373162 2eaf30d92e22a3886ff109279d9830da c727afb94a83ee6d8360cbdfa2cc0640` |

**Vector 3** — [RFC 7914 Test Vector 3 - pleaseletmein/SodiumChloride](https://datatracker.ietf.org/doc/html/rfc7914#section-12)

| Field | Value |
| --- | --- |
| `salt` | `536f6469756d43686c6f72696465` |
| `N` | `16384` |
| `r` | `8` |
| `p` | `1` |
| `keyLength` | `64` |
| `input` | `706c656173656c65746d65696e` |
| `expected` | `7023bdcb3afd7348461c06cd81fd38eb fda8fbba904f8e3ea9b543f6545da1f2 d5432955613f0fcf62d49705242a9af9 e61e85dc0d651e40dfcf017b45575887` |

---

[← All algorithms](../README.md)
