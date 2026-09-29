# RIPEMD-128

> RACE Integrity Primitives Evaluation Message Digest with 128-bit output. Developed as part of the RIPEMD family with dual-path design. Produces a 128-bit hash digest but considered weak by modern standards.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | RIPEMD Family |
| Security status | ⚠️ Deprecated |
| Complexity | Intermediate |
| Inventor | Hans Dobbertin, Antoon Bosselaers, Bart Preneel |
| Year | 1996 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/hash/ripemd.js`](../../../algorithms/hash/ripemd.js) |

## Security

**Status:** ⚠️ Deprecated

No vulnerabilities are recorded for this implementation.

## Documentation

- [RIPEMD-128 Specification](https://homes.esat.kuleuven.be/~bosselae/ripemd160.html)
- [ISO/IEC 10118-3:2004 Standard](https://www.iso.org/standard/39876.html)
- [Wikipedia Article](https://en.wikipedia.org/wiki/RIPEMD)

## References

- [Bouncy Castle Java Implementation](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/digests/RIPEMD128Digest.java)
- [Original RIPEMD Family Specification](https://homes.esat.kuleuven.be/~bosselae/ripemd160.html)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty string test vector](https://homes.esat.kuleuven.be/~bosselae/ripemd160.html)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `cdf26213a150dc3ecb610f18f6b38b46` |

**Vector 2** — [Single character 'a' test vector](https://homes.esat.kuleuven.be/~bosselae/ripemd160.html)

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `86be7afa339d0fc7cfc785e72f578d33` |

**Vector 3** — [String 'abc' test vector](https://homes.esat.kuleuven.be/~bosselae/ripemd160.html)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `c14a12199c66e4ba84636b0f69144c77` |

**Vector 4** — [String 'message digest' test vector](https://homes.esat.kuleuven.be/~bosselae/ripemd160.html)

| Field | Value |
| --- | --- |
| `input` | `6d65737361676520646967657374` |
| `expected` | `9e327b3d6e523062afc1132d7df9d1b8` |

**Vector 5** — [Lowercase alphabet test vector](https://homes.esat.kuleuven.be/~bosselae/ripemd160.html)

| Field | Value |
| --- | --- |
| `input` | `6162636465666768696a6b6c6d6e6f707172737475767778797a` |
| `expected` | `fd2aa607f71dc8f510714922b371834e` |

**Vector 6** — [Repeated pattern test vector](https://homes.esat.kuleuven.be/~bosselae/ripemd160.html)

| Field | Value |
| --- | --- |
| `input` | `61626364626364656364656664656667 65666768666768696768696a68696a6b 696a6b6c6a6b6c6d6b6c6d6e6c6d6e6f 6d6e6f706e6f7071` |
| `expected` | `a1aa0689d0fafa2ddc22e88b49133a06` |

**Vector 7** — [Alphanumeric test vector](https://homes.esat.kuleuven.be/~bosselae/ripemd160.html)

| Field | Value |
| --- | --- |
| `input` | `4142434445464748494a4b4c4d4e4f50 5152535455565758595a616263646566 6768696a6b6c6d6e6f70717273747576 7778797a30313233343536373839` |
| `expected` | `d1e959eb179c911faea4624c60c5c702` |

**Vector 8** — [Repeated digits test vector](https://homes.esat.kuleuven.be/~bosselae/ripemd160.html)

| Field | Value |
| --- | --- |
| `input` | `31323334353637383930313233343536 37383930313233343536373839303132 33343536373839303132333435363738 39303132333435363738393031323334 35363738393031323334353637383930` |
| `expected` | `3f45ef194732c2dbb2c4a2c769795fa3` |

---

[← All algorithms](../README.md)
