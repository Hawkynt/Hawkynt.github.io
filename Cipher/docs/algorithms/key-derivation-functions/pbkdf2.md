# PBKDF2

> Password-Based Key Derivation Function 2 (PBKDF2) using HMAC-SHA1 for key stretching. Converts passwords into cryptographic keys through iterative hashing. Educational implementation demonstrating key derivation principles.

## Properties

| Property | Value |
| --- | --- |
| Category | Key Derivation Functions |
| Sub-category | Key Derivation Function |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | RSA Laboratories |
| Year | 2000 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/kdf/pbkdf2.js`](../../../algorithms/kdf/pbkdf2.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 1 byte (8 bits); 128 bytes (1024 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SaltRequired` | Yes |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Timing Attacks | Use constant-time comparison for password verification and sufficient iteration counts | — |
| Insufficient Iteration Count | Use minimum 100,000 iterations for 2023. Increase over time as computing power grows | — |

## Documentation

- [RFC 2898 - PKCS #5: Password-Based Cryptography Specification](https://tools.ietf.org/html/rfc2898)
- [Wikipedia - PBKDF2](https://en.wikipedia.org/wiki/PBKDF2)
- [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

## References

- [NIST SP 800-132](https://csrc.nist.gov/publications/detail/sp/800-132/final)
- [bcrypt vs PBKDF2](https://security.stackexchange.com/questions/4781/do-any-security-experts-recommend-bcrypt-for-password-storage)
- [Python PBKDF2 Implementation](https://docs.python.org/3/library/hashlib.html#hashlib.pbkdf2_hmac)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 6070 Test Vector 1: password/salt, 1 iteration](https://tools.ietf.org/html/rfc6070)

| Field | Value |
| --- | --- |
| `salt` | `73616c74` |
| `iterations` | `1` |
| `outputSize` | `20` |
| `input` | `70617373776f7264` |
| `expected` | `0c60c80f961f0e71f3a9b524af6012062fe037a6` |

**Vector 2** — [RFC 6070 Test Vector 2: password/salt, 2 iterations](https://tools.ietf.org/html/rfc6070)

| Field | Value |
| --- | --- |
| `salt` | `73616c74` |
| `iterations` | `2` |
| `outputSize` | `20` |
| `input` | `70617373776f7264` |
| `expected` | `ea6c014dc72d6f8ccd1ed92ace1d41f0d8de8957` |

---

[← All algorithms](../README.md)
