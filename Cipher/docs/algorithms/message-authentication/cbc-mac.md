# CBC-MAC

> Cipher Block Chaining Message Authentication Code using a block cipher in CBC mode. Foundation for more secure variants like CMAC.

## Properties

| Property | Value |
| --- | --- |
| Category | Message Authentication |
| Sub-category | Block Cipher MAC |
| Security status | ⚠️ Deprecated |
| Complexity | Beginner |
| Inventor | Various (standard construction) |
| Year | 1976 |
| Origin | Not specified |
| Source | [`algorithms/mac/cbcmac.js`](../../../algorithms/mac/cbcmac.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| MAC sizes | 4 bytes (32 bits) to 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `NeedsKey` | Yes |

## Security

**Status:** ⚠️ Deprecated

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Variable Length Extension Attack](https://en.wikipedia.org/wiki/CBC-MAC#Security) | — | CBC-MAC is insecure for variable-length messages without additional protection. An attacker can forge MACs by extending messages. |

## Documentation

- [FIPS 113 - Computer Data Authentication](https://csrc.nist.gov/publications/detail/fips/113/archive/1985-05-30)
- [ISO/IEC 9797-1:1999 - MAC Algorithm 1](https://www.iso.org/standard/50375.html)
- [NIST SP 800-38B - CMAC (successor)](https://csrc.nist.gov/publications/detail/sp/800-38b/final)

## References

- [BouncyCastle CBCBlockCipherMac](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/macs/CBCBlockCipherMac.java)
- [Handbook of Applied Cryptography - Section 9.5](http://cacr.uwaterloo.ca/hac/about/chap9.pdf)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [FIPS 113 / BouncyCastle Test #1 - Zero IV, Non-aligned](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/MacTest.java)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdef` |
| `macSize` | `4` |
| `input` | `37363534333231204e6f77206973207468652074696d6520666f7220` |
| `expected` | `f1d30f68` |

**Vector 2** — [BouncyCastle Test #2 - Explicit IV, Non-aligned](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/MacTest.java)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdef` |
| `iv` | `1234567890abcdef` |
| `macSize` | `4` |
| `input` | `37363534333231204e6f77206973207468652074696d6520666f7220` |
| `expected` | `58d2e77e` |

**Vector 3** — [BouncyCastle Test #3 - Word Aligned (Zero Padding)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/MacTest.java)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdef` |
| `macSize` | `4` |
| `input` | `3736353433323120` |
| `expected` | `21fb1936` |

**Vector 4** — [BouncyCastle Test #4 - Full MAC Length](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/MacTest.java)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdef` |
| `macSize` | `8` |
| `input` | `37363534333231204e6f77206973207468652074696d6520666f7220` |
| `expected` | `f1d30f6849312ca4` |

---

[← All algorithms](../README.md)
