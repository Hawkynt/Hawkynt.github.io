# SipHash-128

> 128-bit output variant of SipHash. Fast cryptographically secure PRF producing 16-byte MAC tags. Default configuration uses 2 compression rounds and 4 finalization rounds (SipHash-2-4-128).

## Properties

| Property | Value |
| --- | --- |
| Category | Message Authentication |
| Sub-category | Pseudo-Random Function |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | Jean-Philippe Aumasson, Daniel J. Bernstein |
| Year | 2012 |
| Origin | 🇨🇭 Switzerland |
| Source | [`algorithms/mac/siphash128.js`](../../../algorithms/mac/siphash128.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Output sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `NeedsKey` | Yes |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [SipHash Paper](https://cr.yp.to/siphash/siphash-20120918.pdf)
- [SipHash Official Repository](https://github.com/veorq/SipHash)
- [BouncyCastle SipHash128 Reference](https://github.com/bcgit/bc-lts-java/blob/main/core/src/main/java/org/bouncycastle/crypto/macs/SipHash128.java)

## References

- [RFC 9018 (DNS Cookie usage)](https://www.rfc-editor.org/rfc/rfc9018.txt)
- [SipHash Test Vectors](https://github.com/veorq/SipHash/blob/master/vectors.h)
- [BouncyCastle Test Suite](https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SipHash128Test.java)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SipHash-128 Official Vector #0 (empty input)](https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SipHash128Test.java)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | _(empty)_ |
| `expected` | `a3817f04ba25a8e66df67214c7550293` |

**Vector 2** — [SipHash-128 Official Vector #1 (1 byte: 0x00)](https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SipHash128Test.java)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00` |
| `expected` | `da87c1d86b99af44347659119b22fc45` |

**Vector 3** — [SipHash-128 Official Vector #2 (2 bytes: 0x00, 0x01)](https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SipHash128Test.java)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001` |
| `expected` | `8177228da4a45dc7fca38bdef60affe4` |

**Vector 4** — [SipHash-128 Official Vector #3 (3 bytes: 0x00, 0x01, 0x02)](https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SipHash128Test.java)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102` |
| `expected` | `9c70b60c5267a94e5f33b6b02985ed51` |

**Vector 5** — [SipHash-128 Official Vector #7 (7 bytes)](https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SipHash128Test.java)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00010203040506` |
| `expected` | `a1f1ebbed8dbc153c0b84aa61ff08239` |

**Vector 6** — [SipHash-128 Official Vector #15 (15 bytes)](https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SipHash128Test.java)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e` |
| `expected` | `5493e99933b0a8117e08ec0f97cfc3d9` |

**Vector 7** — [SipHash-128 Official Vector #31 (31 bytes)](https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SipHash128Test.java)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e` |
| `expected` | `2939b0183223fafc1723de4f52c43d35` |

---

[← All algorithms](../README.md)
