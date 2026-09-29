# RC2-WRAP

> RC2 Key Wrap per RFC 3217. Wraps cryptographic key material using RC2-CBC with CMS Key Checksum for integrity verification. Deprecated in favor of AES Key Wrap.

## Properties

| Property | Value |
| --- | --- |
| Category | Special Algorithms |
| Sub-category | Key Wrapping |
| Security status | ⚠️ Deprecated |
| Complexity | Intermediate |
| Inventor | RSA Security Inc. |
| Year | 2001 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/special/rc2wrap.js`](../../../algorithms/special/rc2wrap.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 1 byte (8 bits) to 128 bytes (1024 bits) |

## Security

**Status:** ⚠️ Deprecated

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| RC2 Cipher Weaknesses | RC2 has known weaknesses including related-key attacks and linear cryptanalysis | Use AES Key Wrap (RFC 3394) instead |
| Deprecated Algorithm | RC2 Key Wrap is deprecated and should not be used for new applications | Migrate to AES-KW or AES-KWP |

## Documentation

- [RFC 3217 - RC2 Key Wrap](https://www.rfc-editor.org/rfc/rfc3217.txt)
- [RFC 2268 - RC2 Cipher](https://www.rfc-editor.org/rfc/rfc2268.txt)
- [CMS Key Checksum (RFC 3852)](https://www.rfc-editor.org/rfc/rfc3852.txt)

## References

- [Bouncy Castle RC2WrapEngine](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/RC2WrapEngine.java)
- [NIST Key Wrap Specification](https://csrc.nist.gov/publications/detail/sp/800-38f/final)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 3217 RC2 Key Wrap Example (40-bit effective)](https://www.rfc-editor.org/rfc/rfc3217.txt)

| Field | Value |
| --- | --- |
| `key` | `fd04fd08060707fb0003fefffd02fe05` |
| `iv` | `c7d90059b29e97f7` |
| `effectiveBits` | `40` |
| `pad` | `4845cce7fd1250` |
| `input` | `b70a25fbc9d86a86050ce0d711ead4d9` |
| `expected` | `70e699fb5701f7833330fb71e87c85a4 20bdc99af05d22af5a0e48d35f313898 6cbaafb4b28d4f35` |

---

[← All algorithms](../README.md)
