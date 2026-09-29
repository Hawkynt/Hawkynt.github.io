# KW

> KW (Key Wrap) is a specialized mode designed specifically for securely wrapping (encrypting) cryptographic keys. It provides both confidentiality and integrity protection for key material using a deterministic algorithm with built-in authentication. Commonly used for protecting symmetric keys with a key encryption key (KEK).

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Key Wrapping Mode |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | NIST |
| Year | 2001 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/modes/kw.js`](../../../algorithms/modes/kw.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `RequiresIV` | No |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Deterministic Nature | Key Wrap is deterministic - identical keys will produce identical wrapped values. This may leak information in some contexts. | — |
| Key Size Restrictions | Input key must be multiple of 64 bits (8 bytes). Minimum key size is 128 bits (16 bytes). | — |

## Documentation

- [RFC 3394 - AES Key Wrap](https://tools.ietf.org/rfc/rfc3394.txt)
- [NIST SP 800-38F](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38F.pdf)
- [FIPS 197 AES](https://nvlpubs.nist.gov/nistpubs/fips/nist.fips.197.pdf)

## References

- [OpenSSL Key Wrap](https://github.com/openssl/openssl/blob/master/crypto/modes/wrap128.c)
- [Crypto++ Key Wrap](https://github.com/weidai11/cryptopp/blob/master/keywrap.cpp)
- [Java KeyWrap Cipher](https://docs.oracle.com/javase/8/docs/technotes/guides/security/crypto/CryptoSpec.html#KeyWrap)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 3394 4.1 - wrap 128 bits of key data with a 128-bit KEK](https://www.rfc-editor.org/rfc/rfc3394.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `kek` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `1fa68b0a8112b447aef34bd8fb5a7b829d3e862371d2cfe5` |

**Vector 2** — [RFC 3394 4.2 - wrap 128 bits of key data with a 192-bit KEK](https://www.rfc-editor.org/rfc/rfc3394.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `kek` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `96778b25ae6ca435f92b5b97c050aed2468ab8a17ad84e5d` |

**Vector 3** — [RFC 3394 4.3 - wrap 128 bits of key data with a 256-bit KEK](https://www.rfc-editor.org/rfc/rfc3394.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `kek` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `64e8c3f9ce0f5ba263e9777905818a2a93c8191e7d6e8ae7` |

**Vector 4** — [RFC 3394 4.4 - wrap 192 bits of key data with a 192-bit KEK](https://www.rfc-editor.org/rfc/rfc3394.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `kek` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `input` | `00112233445566778899aabbccddeeff0001020304050607` |
| `expected` | `031d33264e15d33268f24ec260743edce1c6c7ddee725a936ba814915c6762d2` |

**Vector 5** — [RFC 3394 4.5 - wrap 192 bits of key data with a 256-bit KEK](https://www.rfc-editor.org/rfc/rfc3394.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `kek` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `00112233445566778899aabbccddeeff0001020304050607` |
| `expected` | `a8f9bc1612c68b3ff6e6f4fbe30e71e4769c8b80a32cb8958cd5d17d6b254da1` |

**Vector 6** — [RFC 3394 4.6 - wrap 256 bits of key data with a 256-bit KEK](https://www.rfc-editor.org/rfc/rfc3394.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `kek` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `00112233445566778899aabbccddeeff000102030405060708090a0b0c0d0e0f` |
| `expected` | `28c9f404c4b810f4cbccb35cfb87f826 3f5786e2d80ed326cbc7f0e71a99f43b fb988b9b7a02dd21` |

---

[← All algorithms](../README.md)
