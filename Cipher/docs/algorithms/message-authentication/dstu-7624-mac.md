# DSTU 7624 MAC

> Ukrainian national MAC standard based on Kalyna block cipher. Provides cryptographic authentication. Current implementation supports 128-bit blocks with 128/256-bit keys.

## Properties

| Property | Value |
| --- | --- |
| Category | Message Authentication |
| Sub-category | Block Cipher MAC |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | Roman Oliynykov, Ivan Gorbenko, et al. |
| Year | 2014 |
| Origin | 🇺🇦 Ukraine |
| Source | [`algorithms/mac/dstu7624mac.js`](../../../algorithms/mac/dstu7624mac.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| MAC sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `NeedsKey` | Yes |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [DSTU 7624:2014 - Ukrainian Encryption Standard](http://dstszi.kmu.gov.ua/document/92213)
- [ISO/IEC 9797-1 - MAC Algorithms](https://www.iso.org/standard/50375.html)

## References

- [BouncyCastle DSTU7624Mac](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/macs/DSTU7624Mac.java)
- [Kalyna Cipher Specification](https://eprint.iacr.org/2015/650.pdf)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [BouncyCastle Test Vector 1 - 128-bit block](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/DSTU7624Test.java)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `blockSize` | `16` |
| `macSize` | `16` |
| `input` | `202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f` |
| `expected` | `123b4eab8e63ecf3e645a99c1115e241` |

---

[← All algorithms](../README.md)
