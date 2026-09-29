# RC2

> RC2 variable-key-size block cipher with 64-bit blocks. Uses mixing and mashing operations over 18 rounds. Developed by Ron Rivest at RSA Data Security in 1987. Cryptographically broken.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | ❌ Broken |
| Complexity | Intermediate |
| Inventor | Ron Rivest |
| Year | 1987 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/rc.js`](../../../algorithms/block/rc.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 1 byte (8 bits) to 128 bytes (1024 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Related-key attacks | RC2 is vulnerable to related-key attacks due to weak key schedule | Use AES or other modern ciphers instead |
| Linear cryptanalysis | RC2 has linear approximations that reduce effective security | Algorithm is obsolete for secure applications |

## Documentation

- [RFC 2268 - RC2 Algorithm Description](https://www.rfc-editor.org/rfc/rfc2268.txt)
- [RSA Data Security RC2 Specification](https://www.rsa.com/en-us/company/labs/historical-cryptanalysis/rc2)

## References

- [Bouncy Castle RC2 Implementation](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/RC2Engine.java)
- [NIST Computer Security Resource Center](https://csrc.nist.gov/projects/block-cipher-techniques)
- [Applied Cryptography by Bruce Schneier](https://www.schneier.com/books/applied_cryptography/)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 2268 Test Vector #1: 8-byte all-zero key, 63-bit effective](https://www.rfc-editor.org/rfc/rfc2268.txt)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000` |
| `effectiveBits` | `63` |
| `input` | `0000000000000000` |
| `expected` | `ebb773f993278eff` |

**Vector 2** — [RFC 2268 Test Vector #2: 8-byte all-ones key, 64-bit effective](https://www.rfc-editor.org/rfc/rfc2268.txt)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffff` |
| `effectiveBits` | `64` |
| `input` | `ffffffffffffffff` |
| `expected` | `278b27e42e2f0d49` |

**Vector 3** — [RFC 2268 Test Vector #3: pattern key and plaintext, 64-bit effective](https://www.rfc-editor.org/rfc/rfc2268.txt)

| Field | Value |
| --- | --- |
| `key` | `3000000000000000` |
| `effectiveBits` | `64` |
| `input` | `1000000000000001` |
| `expected` | `30649edf9be7d2c2` |

**Vector 4** — [RFC 2268 Test Vector #4: 1-byte key, 64-bit effective](https://www.rfc-editor.org/rfc/rfc2268.txt)

| Field | Value |
| --- | --- |
| `key` | `88` |
| `effectiveBits` | `64` |
| `input` | `0000000000000000` |
| `expected` | `61a8a244adacccf0` |

**Vector 5** — [RFC 2268 Test Vector #5: 7-byte key, 64-bit effective](https://www.rfc-editor.org/rfc/rfc2268.txt)

| Field | Value |
| --- | --- |
| `key` | `88bca90e90875a` |
| `effectiveBits` | `64` |
| `input` | `0000000000000000` |
| `expected` | `6ccf4308974c267f` |

**Vector 6** — [RFC 2268 Test Vector #6: 16-byte key, 64-bit effective](https://www.rfc-editor.org/rfc/rfc2268.txt)

| Field | Value |
| --- | --- |
| `key` | `88bca90e90875a7f0f79c384627bafb2` |
| `effectiveBits` | `64` |
| `input` | `0000000000000000` |
| `expected` | `1a807d272bbe5db1` |

**Vector 7** — [RFC 2268 Test Vector #7: 16-byte key, 128-bit effective](https://www.rfc-editor.org/rfc/rfc2268.txt)

| Field | Value |
| --- | --- |
| `key` | `88bca90e90875a7f0f79c384627bafb2` |
| `effectiveBits` | `128` |
| `input` | `0000000000000000` |
| `expected` | `2269552ab0f85ca6` |

---

[← All algorithms](../README.md)
