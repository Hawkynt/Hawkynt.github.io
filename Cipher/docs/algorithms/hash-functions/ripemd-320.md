# RIPEMD-320

> Extended RIPEMD hash function producing 320-bit digest. Uses dual 160-bit computation pipelines for enhanced security margin. Part of the RIPEMD family designed as European alternative to MD/SHA.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Cryptographic Hash |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Hans Dobbertin, Antoon Bosselaers, Bart Preneel |
| Year | 1996 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/hash/ripemd.js`](../../../algorithms/hash/ripemd.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [RIPEMD-160: A Strengthened Version of RIPEMD](https://homes.esat.kuleuven.be/~bosselae/ripemd160.html)
- [ISO/IEC 10118-3:2004 Standard](https://www.iso.org/standard/39876.html)
- [Wikipedia Article](https://en.wikipedia.org/wiki/RIPEMD)

## References

- [OpenSSL Implementation](https://github.com/openssl/openssl/tree/master/crypto/ripemd)
- [Bouncy Castle Java Implementation](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/digests/RIPEMD320Digest.java)
- [Original Specification](https://homes.esat.kuleuven.be/~bosselae/ripemd160.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty string test vector (Bouncy Castle)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/RIPEMD320DigestTest.java)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `22d65d5661536cdc75c1fdf5c6de7b41 b9f27325ebc61e8557177d705a0ec880 151c3a32a00899b8` |

**Vector 2** — [Single character 'a' test vector (Bouncy Castle)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/RIPEMD320DigestTest.java)

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `ce78850638f92658a5a585097579926d da667a5716562cfcf6fbe77f63542f99 b04705d6970dff5d` |

**Vector 3** — [String 'abc' test vector (Bouncy Castle)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/RIPEMD320DigestTest.java)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `de4c01b3054f8930a79d09ae738e9230 1e5a17085beffdc1b8d116713e74f82f a942d64cdbc4682d` |

**Vector 4** — [Alphabet test vector (Bouncy Castle)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/RIPEMD320DigestTest.java)

| Field | Value |
| --- | --- |
| `input` | `6162636465666768696a6b6c6d6e6f707172737475767778797a` |
| `expected` | `cabdb1810b92470a2093aa6bce05952c 28348cf43ff60841975166bb40ed2340 04b8824463e6b009` |

---

[← All algorithms](../README.md)
