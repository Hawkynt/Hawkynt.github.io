# FPE

> FPE (Format-Preserving Encryption) is a general framework for encryption schemes that preserve the format and structure of input data. It enables encryption of structured data like credit card numbers, phone numbers, and database fields while maintaining their original format, length, and character sets. Input must be 7-bit text containing at least two characters of the configured alphabet; characters outside the alphabet are passed through unchanged when format preservation is on. Bytes with the high bit set are rejected, since the text conversion cannot represent them and both directions must agree on which characters are encrypted.

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Format-Preserving Encryption |
| Security status | 🧪 Experimental |
| Complexity | Research |
| Inventor | Various (NIST standardization) |
| Year | 2009 |
| Origin | 🇺🇸 United States |
| Restricted input domain | 7-bit text with at least two characters of the configured alphabet |
| Source | [`algorithms/modes/fpe.js`](../../../algorithms/modes/fpe.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `RequiresIV` | No |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Small Domain Security | FPE security degrades with small alphabets or short strings. Minimum security requires alphabet size × string length ≥ 1,000,000. | — |
| Implementation Complexity | Proper FPE requires careful implementation of cycle-walking, radix conversion, and PRF construction to avoid bias and maintain security. | — |

## Documentation

- [NIST SP 800-38G](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38G.pdf)
- [Format-Preserving Encryption Survey](https://web.cs.ucdavis.edu/~rogaway/papers/fpe.pdf)
- [FF1 and FF3 Modes](https://csrc.nist.gov/publications/detail/sp/800-38g/final)

## References

- [Python FPE Implementation](https://github.com/mysto/python-fpe)
- [Java FPE Library](https://github.com/privacylogistics/java-fpe)
- [C++ FPE Implementation](https://github.com/capitalone/fpe)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST FF1 sample 1 - AES-128, radix 10, empty tweak](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `tweak` | _(empty)_ |
| `alphabet` | 0123456789 |
| `input` | `30313233343536373839` |
| `expected` | `32343333343737343834` |

**Vector 2** — [NIST FF1 sample 2 - AES-128, radix 10, 10-byte tweak](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `tweak` | `39383736353433323130` |
| `alphabet` | 0123456789 |
| `input` | `30313233343536373839` |
| `expected` | `36313234323030373733` |

**Vector 3** — [NIST FF1 sample 3 - AES-128, radix 36, 11-byte tweak](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `tweak` | `3737373770717273373737` |
| `alphabet` | 0123456789abcdefghijklmnopqrstuvwxyz |
| `input` | `30313233343536373839616263646566676869` |
| `expected` | `6139747634306d6c6c396b647535303965756d` |

**Vector 4** — [NIST FF1 sample 4 - AES-192, radix 10, empty tweak](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `2b7e151628aed2a6abf7158809cf4f3cef4359d8d580aa4f` |
| `tweak` | _(empty)_ |
| `alphabet` | 0123456789 |
| `input` | `30313233343536373839` |
| `expected` | `32383330363638313332` |

**Vector 5** — [NIST FF1 sample 7 - AES-256, radix 10, empty tweak](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `2b7e151628aed2a6abf7158809cf4f3cef4359d8d580aa4f7f036d6f04fc6a94` |
| `tweak` | _(empty)_ |
| `alphabet` | 0123456789 |
| `input` | `30313233343536373839` |
| `expected` | `36363537363637303039` |

---

[← All algorithms](../README.md)
