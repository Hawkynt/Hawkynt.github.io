# ISO9797 Algorithm 3

> Retail MAC (ANSI X9.19) using block cipher with encrypt-decrypt-encrypt pattern on final block. Two or three key construction commonly used with DES in banking systems.

## Properties

| Property | Value |
| --- | --- |
| Category | Message Authentication |
| Sub-category | Block Cipher MAC |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | ISO/IEC JTC 1/SC 27 |
| Year | 1999 |
| Origin | Not specified |
| Source | [`algorithms/mac/iso9797alg3.js`](../../../algorithms/mac/iso9797alg3.js) |

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

No vulnerabilities are recorded for this implementation.

## Documentation

- [ISO/IEC 9797-1:1999 Specification](https://www.iso.org/standard/50375.html)
- [ANSI X9.19 Standard](https://webstore.ansi.org/standards/ascx9/ansix9191986r1998)
- [BouncyCastle Reference Implementation](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/macs/ISO9797Alg3Mac.java)

## References

- [ISO9797 Algorithm Comparison](https://en.wikipedia.org/wiki/ISO/IEC_9797-1)
- [Retail MAC in Payment Systems](https://www.eftlab.com/knowledge-base/complete-list-of-data-elements/)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [BouncyCastle ISO9797Alg3MacTest Vector #1](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/ISO9797Alg3MacTest.java)

| Field | Value |
| --- | --- |
| `key` | `7ca110454a1a6e570131d9619dc1376e` |
| `input` | `48656c6c6f20576f726c642021212121` |
| `expected` | `f09b856213bab83b` |

---

[← All algorithms](../README.md)
