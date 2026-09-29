# RFC 3211 Key Wrap

> Password-based key wrapping algorithm from RFC 3211 for CMS. Uses CBC mode with random padding and checksum verification. Older standard compared to RFC 3394.

## Properties

| Property | Value |
| --- | --- |
| Category | Special Algorithms |
| Sub-category | Key Wrapping |
| Security status | ⚠️ Deprecated |
| Complexity | Intermediate |
| Inventor | IETF S/MIME Working Group |
| Year | 2001 |
| Origin | 🌐 International |
| Source | [`algorithms/crypto/rfc3211wrap.js`](../../../algorithms/crypto/rfc3211wrap.js) |

## Security

**Status:** ⚠️ Deprecated

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 3211 - Password-based Encryption for CMS](https://www.rfc-editor.org/rfc/rfc3211.txt)
- [RFC 3211 at IETF](https://datatracker.ietf.org/doc/rfc3211/)

## References

- [BouncyCastle RFC3211WrapEngine (Java)](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/RFC3211WrapEngine.java)
- [BouncyCastle RFC3211WrapEngine (C#)](https://github.com/bcgit/bc-csharp/blob/master/crypto/src/crypto/engines/RFC3211WrapEngine.cs)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DES-CBC Key Wrap - 64-bit key with fixed random](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/RFC3211WrapTest.java)

| Field | Value |
| --- | --- |
| `cipherName` | DES |
| `key` | `d1daa78615f287e6` |
| `iv` | `efe598ef21b33d6d` |
| `random` | `c436f541` |
| `input` | `8c627c897323a2f8` |
| `expected` | `b81b2565ee373ca6dedca26a178b0c10` |

**Vector 2** — [3DES-CBC Key Wrap - 256-bit key with fixed random](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/RFC3211WrapTest.java)

| Field | Value |
| --- | --- |
| `cipherName` | 3DES (Triple DES) |
| `key` | `6a8970bf68c92caea84a8df28510858607126380cc47ab2d` |
| `iv` | `baf1ca7931213c4e` |
| `random` | `fa060a45` |
| `input` | `8c637d887223a2f965b566eb014b0fa5d52300a3f7ea40fffc577203c71baf3b` |
| `expected` | `c03c514abdb9e2c5aac038572b5e2455 3876b377aafb82eca5a9d73f8ab143d9 ec74e6cad7db260c` |

---

[← All algorithms](../README.md)
