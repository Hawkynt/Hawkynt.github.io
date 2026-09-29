# HKDF

> HMAC-based Key Derivation Function (HKDF) as defined in RFC 5869. Two-step Extract-and-Expand process for deriving cryptographic keys from input keying material using salt and application-specific info parameters.

## Properties

| Property | Value |
| --- | --- |
| Category | Key Derivation Functions |
| Sub-category | Extract-and-Expand KDF |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Hugo Krawczyk, Pasi Eronen |
| Year | 2010 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/kdf/hkdf.js`](../../../algorithms/kdf/hkdf.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 1 byte (8 bits); 16320 bytes (130560 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SaltRequired` | No |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Weak Hash Function | Use secure hash functions like SHA-256 or SHA-512 instead of SHA-1 or MD5 | — |
| Insufficient Input Entropy | Ensure input keying material has sufficient entropy for cryptographic security | — |

## Documentation

- [RFC 5869 - HMAC-based Extract-and-Expand Key Derivation Function (HKDF)](https://tools.ietf.org/html/rfc5869)
- [NIST SP 800-56C - Recommendation for Key Derivation Methods](https://csrc.nist.gov/publications/detail/sp/800-56c/rev-2/final)
- [Wikipedia - HKDF](https://en.wikipedia.org/wiki/HKDF)

## References

- [OpenSSL EVP_PKEY_derive](https://github.com/openssl/openssl/blob/master/crypto/kdf/hkdf.c)
- [Python cryptography.hazmat.primitives.kdf.hkdf](https://cryptography.io/en/latest/hazmat/primitives/key-derivation-functions/#hkdf)
- [Go crypto/hkdf](https://golang.org/pkg/golang.org/x/crypto/hkdf/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [HKDF-SHA256 RFC 5869 Test Case 1](https://tools.ietf.org/html/rfc5869)

| Field | Value |
| --- | --- |
| `salt` | `000102030405060708090a0b0c` |
| `info` | `f0f1f2f3f4f5f6f7f8f9` |
| `outputSize` | `42` |
| `hashFunction` | SHA256 |
| `input` | `0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b` |
| `expected` | `3cb25f25faacd57a90434f64d0362f2a 2d2d0a90cf1a5a4c5db02d56ecc4c5bf 34007208d5b887185865` |

**Vector 2** — [HKDF-SHA256 RFC 5869 Test Case 2 - longer inputs](https://tools.ietf.org/html/rfc5869)

| Field | Value |
| --- | --- |
| `salt` | `606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf` |
| `info` | `b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `outputSize` | `82` |
| `hashFunction` | SHA256 |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f` |
| `expected` | `b11e398dc80327a1c8e7f78c596a4934 4f012eda2d4efad8a050cc4c19afa97c 59045a99cac7827271cb41c65e590e09 da3275600c2f09b8367793a9aca3db71 cc30c58179ec3e87c14c01d5c1f3434f 1d87` |

**Vector 3** — [HKDF-SHA256 RFC 5869 Test Case 3 - zero-length salt](https://tools.ietf.org/html/rfc5869)

| Field | Value |
| --- | --- |
| `salt` | _(empty)_ |
| `info` | _(empty)_ |
| `outputSize` | `42` |
| `hashFunction` | SHA256 |
| `input` | `0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b` |
| `expected` | `8da4e775a563c18f715f802a063c5a31 b8a11f5c5ee1879ec3454e5f3c738d2d 9d201395faa4b61a96c8` |

---

[← All algorithms](../README.md)
