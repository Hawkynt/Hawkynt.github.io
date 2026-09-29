# Camellia Key Wrap

> RFC 3657 key wrapping algorithm using Camellia cipher. Securely wraps cryptographic keys for transport using the RFC 3394 key wrap construction with Camellia.

## Properties

| Property | Value |
| --- | --- |
| Category | Special Algorithms |
| Sub-category | Key Wrapping |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | RFC 3657 Authors, based on Camellia by NTT/Mitsubishi |
| Year | 2003 |
| Origin | Not specified |
| Source | [`algorithms/crypto/camelliawrap.js`](../../../algorithms/crypto/camelliawrap.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits); 24 bytes (192 bits); 32 bytes (256 bits) |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 3657 - Camellia Key Wrap](https://www.rfc-editor.org/rfc/rfc3657.txt)
- [RFC 3394 - AES Key Wrap (base algorithm)](https://www.rfc-editor.org/rfc/rfc3394.txt)
- [NIST Key Wrap Specification](https://csrc.nist.gov/projects/key-management/key-wrap)

## References

- [Bouncy Castle Implementation](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/CamelliaWrapEngine.java)
- [RFC 3713 - Camellia Cipher](https://tools.ietf.org/rfc/rfc3713.txt)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Bouncy Castle Camellia-128 Wrap Test Vector](https://github.com/bcgit/bc-java/blob/master/prov/src/test/java/org/bouncycastle/jce/provider/test/CamelliaTest.java)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `635d6ac46eedebd3a7f4a06421a4cbd1746b24795ba2f708` |

---

[← All algorithms](../README.md)
