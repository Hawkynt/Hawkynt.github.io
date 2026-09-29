# Triple DES Key Wrap

> RFC 3217 key wrapping using Triple-DES in CBC mode with CMS key checksum. Wraps cryptographic keys for secure transport using 3DES encryption and SHA-1 integrity checking.

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
| Source | [`algorithms/crypto/desedewrap.js`](../../../algorithms/crypto/desedewrap.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 24 bytes (192 bits) |

## Security

**Status:** ⚠️ Deprecated

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Deprecated Algorithm | Triple-DES is deprecated by NIST. SHA-1 checksum is cryptographically broken. | Use AES Key Wrap (RFC 3394) for modern applications |
| Small Block Size | 64-bit block size limits the amount of data that can be safely wrapped | Use AES-based key wrapping for larger keys |

## Documentation

- [RFC 3217 - Triple-DES Key Wrap](https://www.rfc-editor.org/rfc/rfc3217.txt)
- [CMS Key Checksum Algorithm](https://www.w3.org/TR/xmlenc-core/#sec-CMSKeyChecksum)
- [NIST SP 800-38F - Block Cipher Modes (Key Wrap)](https://csrc.nist.gov/publications/detail/sp/800-38f/final)

## References

- [Bouncy Castle DESedeWrapEngine](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/DESedeWrapEngine.java)
- [RFC 3217 Specification](https://www.rfc-editor.org/rfc/rfc3217.txt)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 3217 Example - Triple-DES Key Wrap](https://www.rfc-editor.org/rfc/rfc3217.txt)

| Field | Value |
| --- | --- |
| `key` | `255e0d1c07b646dfb3134cc843ba8aa71f025b7c0838251f` |
| `iv` | `5dd4cbfc96f5453b` |
| `input` | `2923bf85e06dd6ae529149f1f1bae9eab3a7da3d860d3e98` |
| `expected` | `690107618ef092b3b48ca1796b234ae9 fa33ebb4159604037db5d6a84eb3aac2 768c632775a467d4` |

---

[← All algorithms](../README.md)
