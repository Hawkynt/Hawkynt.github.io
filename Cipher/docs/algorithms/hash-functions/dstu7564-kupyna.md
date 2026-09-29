# DSTU7564 (Kupyna)

> Ukrainian national standard hash function. Substitution-permutation network operating on 512/1024-bit states with 64-bit words. ISO/IEC 10118-3:2018 approved algorithm.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Hash Function |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Roman Oliynykov et al. |
| Year | 2015 |
| Origin | 🇺🇦 Ukraine |
| Source | [`algorithms/hash/dstu7564.js`](../../../algorithms/hash/dstu7564.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 32 bytes (256 bits); 48 bytes (384 bits); 64 bytes (512 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [DSTU 7564:2014 Specification (Ukrainian)](https://usts.kiev.ua/wp-content/uploads/2020/07/dstu-7564-2014.pdf)
- [A New Standard of Ukraine: The Kupyna Hash Function (Oliynykov et al., IACR ePrint 2015/885)](https://eprint.iacr.org/2015/885)
- [Bouncy Castle Reference Implementation](https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/digests/DSTU7564Digest.java)
- [Official C Reference Implementation](https://github.com/Roman-Oliynykov/Kupyna-reference)

## References

- [Official Kupyna reference implementation (Roman Oliynykov)](https://github.com/Roman-Oliynykov/Kupyna-reference)
- [Bouncy Castle Java reference implementation (DSTU7564Digest)](https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/digests/DSTU7564Digest.java)

## Test vectors

15 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty string (256-bit)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | _(empty)_ |
| `expected` | `cd5101d1ccdf0d1d1f4ada56e888cd724ca1a0838a3521e7131d4fb78d0f5eb6` |

**Vector 2** — [Single byte 'a' (256-bit)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `61` |
| `expected` | `c51a1d639596fb613d86557314a150c40f8fff3de48bc93a3b03c161f4105ee4` |

**Vector 3** — [String 'abc' (256-bit)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `616263` |
| `expected` | `0bd1b36109f1318411a0517315aa46b8839df06622a278676f5487996c9cfc04` |

**Vector 4** — [64-byte sequence (256-bit)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `08f4ee6f1be6903b324c4e27990cb24ef69dd58dbe84813ee0a52f6631239875` |

**Vector 5** — [128-byte sequence (256-bit)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f` |
| `expected` | `0a9474e645a7d25e255e9e89fff42ec7eb31349007059284f0b182e452bda882` |

**Vector 6** — [256-byte sequence (256-bit)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `d305a32b963d149dc765f68594505d4077024f836c1bf03806e1624ce176c08f` |

**Vector 7** — [Single byte 0xFF (256-bit)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `ff` |
| `expected` | `ea7677ca4526555680441c117982ea14059ea6d0d7124d6ecdb3deec49e890f4` |

**Vector 8** — [95-byte sequence (256-bit)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e` |
| `expected` | `1075c8b0cb910f116bda5fa1f19c29cf8ecc75caff7208ba2994b68fc56e8d16` |

**Vector 9** — [95-byte sequence (384-bit)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java)

| Field | Value |
| --- | --- |
| `outputSize` | `48` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e` |
| `expected` | `d9021692d84e5175735654846ba751e6 d0ed0fac36dfbc0841287dcb0b5584c7 5016c3decc2a6e47c50b2f3811e351b8` |

**Vector 10** — [Empty string (512-bit)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java)

| Field | Value |
| --- | --- |
| `outputSize` | `64` |
| `input` | _(empty)_ |
| `expected` | `656b2f4cd71462388b64a37043ea55db e445d452aecd46c3298343314ef04019 bcfa3f04265a9857f91be91fce197096 187ceda78c9c1c021c294a0689198538` |

**Vector 11** — [64-byte sequence (512-bit)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java)

| Field | Value |
| --- | --- |
| `outputSize` | `64` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `3813e2109118cdfb5a6d5e72f7208dcc c80a2dfb3afdfb02f46992b5edbe536b 3560dd1d7e29c6f53978af58b444e37b a685c0dd910533ba5d78efffc13de62a` |

**Vector 12** — [128-byte sequence (512-bit)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java)

| Field | Value |
| --- | --- |
| `outputSize` | `64` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f` |
| `expected` | `76ed1ac28b1d0143013ffa87213b4090 b356441263c13e03fa060a8cada32b97 9635657f256b15d5fca4a174de029f0b 1b4387c878fcc1c00e8705d783fd7ffe` |

**Vector 13** — [256-byte sequence (512-bit)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java)

| Field | Value |
| --- | --- |
| `outputSize` | `64` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `0dd03d7350c409cb3c29c25893a0724f 6b133fa8b9eb90a64d1a8fa93b565566 11eb187d715a956b107e3bfc76482298 133a9ce8cbc0bd5e1436a5b197284f7e` |

**Vector 14** — [Single byte 0xFF (512-bit)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java)

| Field | Value |
| --- | --- |
| `outputSize` | `64` |
| `input` | `ff` |
| `expected` | `871b18cf754b72740307a97b449abeb3 2b64444cc0d5a4d65830ae5456837a72 d8458f12c8f06c98c616abe11897f862 63b5cb77c420fb375374bec52b6d0292` |

**Vector 15** — [192-byte sequence (512-bit)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/DSTU7564Test.java)

| Field | Value |
| --- | --- |
| `outputSize` | `64` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf` |
| `expected` | `b189bfe987f682f5f167f0d7fa565330 e126b6e592b1c55d44299064ef95b1a5 7f3c2d0ecf17869d1d199ebbd02e8857 fb8add67a8c31f56cd82c016cf743121` |

---

[← All algorithms](../README.md)
