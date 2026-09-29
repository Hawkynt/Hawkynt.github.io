# GOST 28147-89 Key Wrap

> Key wrapping algorithm using GOST 28147-89 block cipher with MAC authentication. Wraps keys by encrypting blocks and appending a 4-byte MAC for integrity verification.

## Properties

| Property | Value |
| --- | --- |
| Category | Special Algorithms |
| Sub-category | Key Wrapping |
| Security status | ⚠️ Deprecated |
| Complexity | Intermediate |
| Inventor | Soviet/Russian standard committee |
| Year | 1989 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/crypto/gost28147wrap.js`](../../../algorithms/crypto/gost28147wrap.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |

## Security

**Status:** ⚠️ Deprecated

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Deprecated standard | GOST 28147-89 has been superseded by newer Russian standards (Kuznyechik/Magma in GOST R 34.12-2015). | Use modern key wrap algorithms like AES Key Wrap (RFC 3394) for new applications. |
| Fixed key size requirement | GOST 28147-89 Key Wrap requires exactly 32 bytes (256 bits) of key material for wrapping. Plaintext must be exactly 32 bytes (4 blocks). | Ensure proper key derivation and size validation before wrapping operations. |

## Documentation

- [GOST 28147-89 Standard (TC26)](https://www.tc26.ru/en/standard/gost/)
- [RFC 4357 - Additional Cryptographic Algorithms for GOST 28147-89](https://www.rfc-editor.org/rfc/rfc4357)
- [GOST R 34.12-2015 Block Ciphers](https://www.tc26.ru/en/standard/gost/GOST_R_3412-2015.pdf)

## References

- [BouncyCastle GOST28147WrapEngine.java](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/GOST28147WrapEngine.java)
- [GOST 28147-89 Block Cipher](https://en.wikipedia.org/wiki/GOST_(block_cipher))

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [GOST 28147-89 Key Wrap - 32-byte key material with UKM](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/GOST28147WrapEngine.java)

| Field | Value |
| --- | --- |
| `key` | `546d203368656c326973652073736e62206167796967747473656865202c3d73` |
| `ukm` | `1234567890abcdef` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `c38aa7f55384318ae9cf31fd318321eb 9b8c95186ecfb5daec6b76079ddbea7c 37650afa` |

---

[← All algorithms](../README.md)
