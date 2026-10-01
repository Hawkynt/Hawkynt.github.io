# PBKDF2

> Password-Based Key Derivation Function 2 (PBKDF2) using HMAC-SHA1 (default), HMAC-SHA224, HMAC-SHA256, HMAC-SHA384 or HMAC-SHA512 for key stretching. Converts passwords into cryptographic keys through iterative hashing. Educational implementation demonstrating key derivation principles.

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
| Output sizes | 1 byte (8 bits) to 128 bytes (1024 bits) |

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

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

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

**Vector 3** — [RFC 7914 section 11: PBKDF2-HMAC-SHA256 passwd/salt, 1 iteration, 64 bytes](https://www.rfc-editor.org/rfc/rfc7914#section-11)

| Field | Value |
| --- | --- |
| `salt` | `73616c74` |
| `hashFunction` | SHA-256 |
| `iterations` | `1` |
| `outputSize` | `64` |
| `input` | `706173737764` |
| `expected` | `55ac046e56e3089fec1691c22544b605 f94185216dde0465e68b9d57c20dacbc 49ca9cccf179b645991664b39d77ef31 7c71b845b1e30bd509112041d3a19783` |

**Vector 4** — [PBKDF2-HMAC-SHA256 Test Case 2: password/salt, 2 iterations, 20 bytes](https://github.com/brycx/Test-Vector-Generation/blob/master/PBKDF2/pbkdf2-hmac-sha2-test-vectors.md)

| Field | Value |
| --- | --- |
| `salt` | `73616c74` |
| `hashFunction` | SHA-256 |
| `iterations` | `2` |
| `outputSize` | `20` |
| `input` | `70617373776f7264` |
| `expected` | `ae4d0c95af6b46d32d0adff928f06dd02a303f8e` |

**Vector 5** — [PBKDF2-HMAC-SHA256 Test Case 5: long password/salt, 4096 iterations, 25 bytes](https://github.com/brycx/Test-Vector-Generation/blob/master/PBKDF2/pbkdf2-hmac-sha2-test-vectors.md)

| Field | Value |
| --- | --- |
| `salt` | `73616c7453414c5473616c7453414c54 73616c7453414c5473616c7453414c54 73616c74` |
| `hashFunction` | SHA-256 |
| `iterations` | `4096` |
| `outputSize` | `25` |
| `input` | `70617373776f726450415353574f524470617373776f7264` |
| `expected` | `348c89dbcbd32b2f32d814b8116e84cf2b17347ebc1800181c` |

**Vector 6** — [PBKDF2-HMAC-SHA256 Test Case 6: pass\0word/sa\0lt, 4096 iterations, 16 bytes](https://github.com/brycx/Test-Vector-Generation/blob/master/PBKDF2/pbkdf2-hmac-sha2-test-vectors.md)

| Field | Value |
| --- | --- |
| `salt` | `7361006c74` |
| `hashFunction` | SHA-256 |
| `iterations` | `4096` |
| `outputSize` | `16` |
| `input` | `7061737300776f7264` |
| `expected` | `89b69d0516f829893c696226650a8687` |

**Vector 7** — [PBKDF2-HMAC-SHA512 Test Case 1: password/salt, 1 iteration, 20 bytes](https://github.com/brycx/Test-Vector-Generation/blob/master/PBKDF2/pbkdf2-hmac-sha2-test-vectors.md)

| Field | Value |
| --- | --- |
| `salt` | `73616c74` |
| `hashFunction` | SHA-512 |
| `iterations` | `1` |
| `outputSize` | `20` |
| `input` | `70617373776f7264` |
| `expected` | `867f70cf1ade02cff3752599a3a53dc4af34c7a6` |

**Vector 8** — [PBKDF2-HMAC-SHA512 Test Case 5: long password/salt, 4096 iterations, 25 bytes](https://github.com/brycx/Test-Vector-Generation/blob/master/PBKDF2/pbkdf2-hmac-sha2-test-vectors.md)

| Field | Value |
| --- | --- |
| `salt` | `73616c7453414c5473616c7453414c54 73616c7453414c5473616c7453414c54 73616c74` |
| `hashFunction` | SHA-512 |
| `iterations` | `4096` |
| `outputSize` | `25` |
| `input` | `70617373776f726450415353574f524470617373776f7264` |
| `expected` | `8c0511f4c6e597c6ac6315d8f0362e225f3c501495ba23b868` |

---

[← All algorithms](../README.md)
