# Tnepres

> Tnepres is a 128-bit 32-round block cipher based on Serpent. Due to endianness confusion in AES submission test vectors, Tnepres is a byte-swapped version using big-endian byte order instead of little-endian.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Ross Anderson, Eli Biham, Lars Knudsen |
| Year | 1998 |
| Origin | 🇬🇧 United Kingdom |
| Source | [`algorithms/block/tnepres.js`](../../../algorithms/block/tnepres.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 8 bytes |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Endianness Confusion](https://www.cl.cam.ac.uk/~rja14/serpent.html) | Tnepres resulted from byte order confusion in original AES submission. Use Serpent for production. | Use corrected Serpent cipher instead of Tnepres |

## Documentation

- [Serpent Algorithm Specification](https://www.cl.cam.ac.uk/~rja14/serpent.html)
- [BouncyCastle Tnepres Implementation](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/TnepresEngine.java)

## References

- [BouncyCastle Serpent Base](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/SerpentEngineBase.java)
- [Serpent vs Tnepres Explanation](https://www.cl.cam.ac.uk/~rja14/serpent.html)

## Test vectors

13 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Tnepres test vector #1 (256-bit key, zero plaintext)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `8910494504181950f98dd998a82b6749` |

**Vector 2** — [Tnepres test vector #2 (128-bit key, bit 0 set)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `80000000000000000000000000000000` |
| `expected` | `10b5ffb720b8cb9002a1142b0ba2e94a` |

**Vector 3** — [Tnepres test vector #3 (128-bit key, bit 39 set)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000008000000000000000000000` |
| `expected` | `4f057a42d8d5bd9746e434680ddcd5e5` |

**Vector 4** — [Tnepres test vector #4 (128-bit key, bit 63 set)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000400000000000` |
| `expected` | `99407bf8582ef12550886ef5b6f169b9` |

**Vector 5** — [Tnepres test vector #5 (192-bit key, bit 0 set)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java)

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000000000000000000000000000` |
| `input` | `40000000000000000000000000000000` |
| `expected` | `d522a3b8d6d89d4d2a124fdd88f36896` |

**Vector 6** — [Tnepres test vector #6 (192-bit key, bit 74 set)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java)

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000000000000000000000000000` |
| `input` | `00000000000200000000000000000000` |
| `expected` | `189b8ec3470085b3da97e82ca8964e32` |

**Vector 7** — [Tnepres test vector #7 (192-bit key, bit 67 set)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java)

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000008000000000` |
| `expected` | `f77d868cf760b9143a89809510ccb099` |

**Vector 8** — [Tnepres test vector #8 (256-bit key, bit 4 set)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `08000000000000000000000000000000` |
| `expected` | `d43b7b981b829342fce0e3ec6f5f4c82` |

**Vector 9** — [Tnepres test vector #9 (256-bit key, bit 71 set)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000100000000000000` |
| `expected` | `0bf30e1a0c33ccf6d5293177886912a7` |

**Vector 10** — [Tnepres test vector #10 (256-bit key, bit 127 set)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000001` |
| `expected` | `6a7f3b805d2ddcba49b89770ade5e507` |

**Vector 11** — [Tnepres test vector #11 (128-bit key bit 0 set)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java)

| Field | Value |
| --- | --- |
| `key` | `80000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `49afbfad9d5a34052cd8ffa5986bd2dd` |

**Vector 12** — [Tnepres test vector #12 (192-bit key bit 86 set)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java)

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000004000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `ba8829b1de058c4b48615d851fc74f17` |

**Vector 13** — [Tnepres test vector #13 (256-bit key bit 199 set)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000100000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `89f64377bf1e8a46c8247044e8056a98` |

---

[← All algorithms](../README.md)
