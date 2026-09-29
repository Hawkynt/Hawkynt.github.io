# Kalyna Key Wrap

> RFC 3394-style key wrapping using the Kalyna block cipher as specified in DSTU 7624:2014. Provides authenticated encryption for key material with integrity verification. Widely used in Ukrainian cryptographic systems.

## Properties

| Property | Value |
| --- | --- |
| Category | Special Algorithms |
| Sub-category | Key Wrapping |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | Ukrainian National Standard |
| Year | 2014 |
| Origin | 🇺🇦 Ukraine |
| Source | [`algorithms/crypto/kalynawrap.js`](../../../algorithms/crypto/kalynawrap.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 8 bytes; 16 bytes (128 bits) to 64 bytes (512 bits) in steps of 16 bytes |
| Block sizes | 128 bytes (1024 bits); 256 bytes (2048 bits); 512 bytes (4096 bits) |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [DSTU 7624:2014 Standard](https://www.dstu.gov.ua/)

## References

- [Bouncy Castle DSTU7624WrapEngine.java Implementation](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/DSTU7624WrapEngine.java)
- [Kalyna Official Reference Implementation (underlying cipher)](https://github.com/Roman-Oliynykov/Kalyna-reference)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DSTU 7624 KW Test 1 (128-bit block)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/DSTU7624Test.java)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `blockSize` | `128` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `1dc91dc6e52575f6dbed25adda95a1b6ad3e15056e489738972c199fb9ee2913` |

**Vector 2** — [DSTU 7624 KW Test 2 (128-bit block, 48 bytes)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/DSTU7624Test.java)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `blockSize` | `128` |
| `input` | `101112131415161718191a1b1c1d1e1f20219000000000000000800000000000` |
| `expected` | `0ea983d6ce48484d51462c32cc616722 10fcc44196abe635baf878fdb83e1a63 114128585d49db355c5819fd38039169` |

**Vector 3** — [DSTU 7624 KW Test 3 (128-bit block, 256-bit key)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/DSTU7624Test.java)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `blockSize` | `128` |
| `input` | `202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f` |
| `expected` | `2d09a7c18e6a5a0816331ec27cea5969 03f77ec8d63f3bdb73299de7fd9f4558 e05992b0b24b39e02ea496368e0841cc 1e3fa44556a3048c5a6e9e335717d17d` |

**Vector 4** — [DSTU 7624 KW Round-trip test (256-bit block)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/DSTU7624Test.java)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `blockSize` | `256` |
| `input` | `202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
