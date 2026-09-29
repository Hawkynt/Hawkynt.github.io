# AES Key Wrap

> NIST-approved key wrapping algorithm (RFC 3394) that securely encrypts cryptographic keys using AES. Provides both confidentiality and integrity protection for key material.

## Properties

| Property | Value |
| --- | --- |
| Category | Special Algorithms |
| Sub-category | Key Wrapping |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | NIST |
| Year | 2001 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/crypto/aeswrap.js`](../../../algorithms/crypto/aeswrap.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 8 bytes |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 3394 - Advanced Encryption Standard (AES) Key Wrap Algorithm](https://www.ietf.org/rfc/rfc3394.txt)
- [NIST SP 800-38F - Recommendation for Block Cipher Modes of Operation: Methods for Key Wrapping](https://csrc.nist.gov/publications/detail/sp/800-38f/final)
- [NIST Key Wrap Specification (Original)](https://csrc.nist.gov/encryption/kms/key-wrap.pdf)

## References

- [BouncyCastle RFC3394WrapEngine](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/RFC3394WrapEngine.java)
- [Botan NIST Key Wrap Implementation](https://github.com/randombit/botan/blob/master/src/lib/misc/nist_keywrap/nist_keywrap.cpp)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 3394 - 128-bit KEK, 128-bit Key Data](https://www.ietf.org/rfc/rfc3394.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `1fa68b0a8112b447aef34bd8fb5a7b829d3e862371d2cfe5` |

**Vector 2** — [RFC 3394 - 192-bit KEK, 128-bit Key Data](https://www.ietf.org/rfc/rfc3394.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `96778b25ae6ca435f92b5b97c050aed2468ab8a17ad84e5d` |

**Vector 3** — [RFC 3394 - 256-bit KEK, 128-bit Key Data](https://www.ietf.org/rfc/rfc3394.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `64e8c3f9ce0f5ba263e9777905818a2a93c8191e7d6e8ae7` |

**Vector 4** — [RFC 3394 - 192-bit KEK, 192-bit Key Data](https://www.ietf.org/rfc/rfc3394.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `input` | `00112233445566778899aabbccddeeff0001020304050607` |
| `expected` | `031d33264e15d33268f24ec260743edce1c6c7ddee725a936ba814915c6762d2` |

**Vector 5** — [RFC 3394 - 256-bit KEK, 192-bit Key Data](https://www.ietf.org/rfc/rfc3394.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `00112233445566778899aabbccddeeff0001020304050607` |
| `expected` | `a8f9bc1612c68b3ff6e6f4fbe30e71e4769c8b80a32cb8958cd5d17d6b254da1` |

**Vector 6** — [RFC 3394 - 256-bit KEK, 256-bit Key Data](https://www.ietf.org/rfc/rfc3394.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `00112233445566778899aabbccddeeff000102030405060708090a0b0c0d0e0f` |
| `expected` | `28c9f404c4b810f4cbccb35cfb87f826 3f5786e2d80ed326cbc7f0e71a99f43b fb988b9b7a02dd21` |

---

[← All algorithms](../README.md)
