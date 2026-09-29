# CFB-MAC

> Cipher Feedback Mode MAC uses a block cipher in CFB mode to generate message authentication codes. Standardized in ISO/IEC 9797-1:1999.

## Properties

| Property | Value |
| --- | --- |
| Category | Message Authentication |
| Sub-category | Block Cipher MAC |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | ISO/IEC JTC 1/SC 27 |
| Year | 1999 |
| Origin | 🌐 International |
| Source | [`algorithms/mac/cfbmac.js`](../../../algorithms/mac/cfbmac.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| MAC sizes | 4 bytes (32 bits) to 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `NeedsKey` | Yes |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Length Extension](https://csrc.nist.gov/publications/detail/sp/800-38b/final) | — | CFB-MAC is vulnerable to message length extension attacks. Use CMAC or HMAC for production. |

## Documentation

- [ISO/IEC 9797-1:1999 - MAC Algorithms](https://www.iso.org/standard/50375.html)
- [BouncyCastle CFBBlockCipherMac](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/macs/CFBBlockCipherMac.java)

## References

- [FIPS 113 - Computer Data Authentication](https://csrc.nist.gov/publications/detail/fips/113/archive/1985-05-30)
- [FIPS 81 - DES Modes of Operation](https://csrc.nist.gov/publications/detail/fips/81/archive/1980-12-02)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [BouncyCastle MacTest Vector 1 - DES CFB-MAC with IV](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/MacTest.java)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdef` |
| `iv` | `1234567890abcdef` |
| `macSize` | `4` |
| `input` | `37363534333231204e6f77206973207468652074696d6520666f7220` |
| `expected` | `cd647403` |

**Vector 2** — [BouncyCastle MacTest Vector 2 - DES CFB-MAC, block-aligned 8 byte message](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/MacTest.java)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdef` |
| `iv` | `1234567890abcdef` |
| `macSize` | `4` |
| `input` | `3736353433323120` |
| `expected` | `3af549c9` |

---

[← All algorithms](../README.md)
