# PBKDF1

> Password-Based Key Derivation Function 1 (PBKDF1) from PKCS #5 v2.0 (RFC 2898 / RFC 8018). Derives cryptographic keys from passwords using iterative hashing with MD5 or SHA-1. Limited to output size of hash function (16 bytes for MD5, 20 bytes for SHA-1). DEPRECATED - use PBKDF2 for new applications.

## Properties

| Property | Value |
| --- | --- |
| Category | Key Derivation Functions |
| Sub-category | Password-Based Key Derivation |
| Security status | ⚠️ Deprecated |
| Complexity | Beginner |
| Inventor | RSA Laboratories |
| Year | 2000 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/kdf/pbkdf1.js`](../../../algorithms/kdf/pbkdf1.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 1 byte (8 bits) to 20 bytes (160 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SaltRequired` | Yes |

## Security

**Status:** ⚠️ Deprecated

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| DEPRECATED Algorithm | PBKDF1 is deprecated. Use PBKDF2, scrypt, or Argon2 for new applications | — |
| Limited Output Size | Output limited to hash digest size (16 bytes for MD5, 20 bytes for SHA-1) | — |
| Weak Hash Functions | Only supports MD5 and SHA-1, both cryptographically weak. MD5 is broken, SHA-1 deprecated | — |
| Insufficient Iteration Count | Modern attacks require much higher iteration counts (100,000+ for PBKDF2) | — |

## Documentation

- [RFC 8018 - PKCS #5: Password-Based Cryptography](https://tools.ietf.org/html/rfc8018)
- [RFC 2898 - Original PKCS #5 v2.0 Specification](https://tools.ietf.org/html/rfc2898)
- [OpenSSL PBKDF1 Implementation](https://github.com/openssl/openssl/blob/master/providers/implementations/kdfs/pbkdf1.c.in)
- [Wikipedia - PBKDF2 (mentions PBKDF1)](https://en.wikipedia.org/wiki/PBKDF2)

## References

- [NIST SP 800-132 - Recommendation for Password-Based Key Derivation](https://csrc.nist.gov/publications/detail/sp/800-132/final)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [OpenSSL Test Vector: password/saltsalt, 1 iteration, SHA-1](https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpkdf_pbkdf1.txt)

| Field | Value |
| --- | --- |
| `salt` | `73616c7473616c74` |
| `iterations` | `1` |
| `outputSize` | `16` |
| `hashFunction` | SHA-1 |
| `input` | `70617373776f7264` |
| `expected` | `cab86dd6261710891e8cb56ee3625691` |

**Vector 2** — [OpenSSL Test Vector: password/saltsalt, 2 iterations, SHA-1](https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpkdf_pbkdf1.txt)

| Field | Value |
| --- | --- |
| `salt` | `73616c7473616c74` |
| `iterations` | `2` |
| `outputSize` | `16` |
| `hashFunction` | SHA-1 |
| `input` | `70617373776f7264` |
| `expected` | `e3a8dfcf2eea6dc81d2ad154274faae9` |

**Vector 3** — [OpenSSL Test Vector: password/saltsalt, 4096 iterations, SHA-1](https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpkdf_pbkdf1.txt)

| Field | Value |
| --- | --- |
| `salt` | `73616c7473616c74` |
| `iterations` | `4096` |
| `outputSize` | `16` |
| `hashFunction` | SHA-1 |
| `input` | `70617373776f7264` |
| `expected` | `3cb0c21e81127f5bff2eea2b5dc3f31d` |

**Vector 4** — [OpenSSL Test Vector: passwordPASSWORDpassword/saltSALT, 65537 iterations, SHA-1](https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpkdf_pbkdf1.txt)

| Field | Value |
| --- | --- |
| `salt` | `73616c7453414c54` |
| `iterations` | `65537` |
| `outputSize` | `16` |
| `hashFunction` | SHA-1 |
| `input` | `70617373776f726450415353574f524470617373776f7264` |
| `expected` | `b2b4635718aaad9fef23fe328eb83ecf` |

**Vector 5** — [OpenSSL Test Vector: empty password/saltsalt, 1 iteration, SHA-1](https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpkdf_pbkdf1.txt)

| Field | Value |
| --- | --- |
| `salt` | `73616c7473616c74` |
| `iterations` | `1` |
| `outputSize` | `16` |
| `hashFunction` | SHA-1 |
| `input` | _(empty)_ |
| `expected` | `2c2abace4bd8bb19f67113da146dbb8c` |

**Vector 6** — [OpenSSL Test Vector: password/saltsalt, 1 iteration, MD5](https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpkdf_pbkdf1.txt)

| Field | Value |
| --- | --- |
| `salt` | `73616c7473616c74` |
| `iterations` | `1` |
| `outputSize` | `16` |
| `hashFunction` | MD5 |
| `input` | `70617373776f7264` |
| `expected` | `fdbdf3419fff98bdb0241390f62a9db3` |

**Vector 7** — [OpenSSL Test Vector: password/saltsalt, 2 iterations, MD5](https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpkdf_pbkdf1.txt)

| Field | Value |
| --- | --- |
| `salt` | `73616c7473616c74` |
| `iterations` | `2` |
| `outputSize` | `16` |
| `hashFunction` | MD5 |
| `input` | `70617373776f7264` |
| `expected` | `3d4a8d4fb4c6e8686b21d36142902966` |

**Vector 8** — [OpenSSL Test Vector: password/saltsalt, 4096 iterations, MD5](https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpkdf_pbkdf1.txt)

| Field | Value |
| --- | --- |
| `salt` | `73616c7473616c74` |
| `iterations` | `4096` |
| `outputSize` | `16` |
| `hashFunction` | MD5 |
| `input` | `70617373776f7264` |
| `expected` | `3283ed8f8d037045157da055bff84a02` |

---

[← All algorithms](../README.md)
