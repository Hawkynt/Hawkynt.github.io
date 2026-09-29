# RIPEMD-160

> RACE Integrity Primitives Evaluation Message Digest with 160-bit output. Developed as a European alternative to SHA-1 with different design principles. Produces a 160-bit hash digest.

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
- [Bouncy Castle Java Implementation](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/digests/RIPEMD160Digest.java)
- [Original Specification](https://homes.esat.kuleuven.be/~bosselae/ripemd160.html)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RIPEMD-160 empty string - Official OpenSSL test vector](https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpmd_ripemd.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `9c1185a5c5e9fc54612808977ee8f548b2258d31` |

**Vector 2** — [RIPEMD-160 single character 'a' - Official OpenSSL test vector](https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpmd_ripemd.txt)

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `0bdc9d2d256b3ee9daae347be6f4dc835a467ffe` |

**Vector 3** — [RIPEMD-160 string 'abc' - Official OpenSSL test vector](https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpmd_ripemd.txt)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `8eb208f7e05d987a9b044a8e98c6b087f15a0bfc` |

**Vector 4** — [RIPEMD-160 'message digest' - Official OpenSSL test vector](https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpmd_ripemd.txt)

| Field | Value |
| --- | --- |
| `input` | `6d65737361676520646967657374` |
| `expected` | `5d0689ef49d2fae572b881b123a85ffa21595f36` |

**Vector 5** — [RIPEMD-160 lowercase alphabet - Official OpenSSL test vector](https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpmd_ripemd.txt)

| Field | Value |
| --- | --- |
| `input` | `6162636465666768696a6b6c6d6e6f707172737475767778797a` |
| `expected` | `f71c27109c692c1b56bbdceb5b9d2865b3708dbc` |

**Vector 6** — [RIPEMD-160 repeated pattern string - Official OpenSSL test vector](https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpmd_ripemd.txt)

| Field | Value |
| --- | --- |
| `input` | `61626364626364656364656664656667 65666768666768696768696a68696a6b 696a6b6c6a6b6c6d6b6c6d6e6c6d6e6f 6d6e6f706e6f7071` |
| `expected` | `12a053384a9c0c88e405a06c27dcf49ada62eb2b` |

**Vector 7** — [RIPEMD-160 alphanumeric string - Official OpenSSL test vector](https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpmd_ripemd.txt)

| Field | Value |
| --- | --- |
| `input` | `4142434445464748494a4b4c4d4e4f50 5152535455565758595a616263646566 6768696a6b6c6d6e6f70717273747576 7778797a30313233343536373839` |
| `expected` | `b0e20b6e3116640286ed3a87a5713079b21f5189` |

**Vector 8** — [RIPEMD-160 repeated digits (80 chars) - Official OpenSSL test vector](https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpmd_ripemd.txt)

| Field | Value |
| --- | --- |
| `input` | `31323334353637383930313233343536 37383930313233343536373839303132 33343536373839303132333435363738 39303132333435363738393031323334 35363738393031323334353637383930` |
| `expected` | `9b752e45573d4b39f4dbd3323cab82bf63326bfb` |

---

[← All algorithms](../README.md)
