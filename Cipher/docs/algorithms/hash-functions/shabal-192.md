# Shabal-192

> Shabal-192 is a cryptographic hash function submitted to the NIST SHA-3 competition by the Saphir project. It advanced to the second round but was not selected as a finalist. Three registers and a block counter are mixed by a forty-eight step permutation over each 512-bit block.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | SHA-3 Candidate |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Emmanuel Bresson, Anne Canteaut, Benoit Chevallier-Mames, Christophe Clavier, Thomas Fuhr, Aline Gouget, Thomas Icart, Jean-Francois Misarsky, Maria Naya-Plasencia, Pascal Paillier, Thomas Pornin, Jean-Rene Reinhard, Celine Thuillet, Marion Videau |
| Year | 2008 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/hash/shabal.js`](../../../algorithms/hash/shabal.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 24 bytes (192 bits) |
| Hash sizes | 24 bytes (192 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Distinguisher on the keyed permutation | Non-random behaviour was shown for the internal permutation during the SHA-3 second round; no attack on the hash function itself followed, but the result contributed to Shabal not advancing. | — |

## Documentation

- [Shabal Specification](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/sha-3/documents/Shabal.pdf)
- [NIST SHA-3 Competition](https://csrc.nist.gov/projects/hash-functions/sha-3-project)
- [Wikipedia - Shabal](https://en.wikipedia.org/wiki/Shabal)

## References

- [sphlib reference implementation and vectors](https://github.com/pornin/sphlib/blob/master/c/test_shabal.c)
- [RustCrypto Shabal Implementation](https://github.com/RustCrypto/hashes/tree/master/shabal)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [sphlib test_shabal.c - 103-byte reference string](https://github.com/pornin/sphlib/blob/master/c/test_shabal.c)

| Field | Value |
| --- | --- |
| `input` | `6162636465666768696a6b6c6d6e6f70 7172737475767778797a2d3031323334 35363738392d4142434445464748494a 4b4c4d4e4f505152535455565758595a 2d303132333435363738392d61626364 65666768696a6b6c6d6e6f7071727374 75767778797a` |
| `expected` | `690fae79226d95760ae8fdb4f58c0537111756557d307b15` |

---

[← All algorithms](../README.md)
