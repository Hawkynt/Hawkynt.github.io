# Hamsi-256

> SHA-3 candidate hash function with 256-bit output. Uses a Serpent-inspired non-linear permutation with a linear-code based message expansion in a concatenation-truncation construction. Known distinguishers exist against the compression function and output transformation.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Hash Function |
| Security status | 📰 Obsolete |
| Complexity | Advanced |
| Inventor | Özgül Küçük |
| Year | 2008 |
| Origin | Not specified |
| Source | [`algorithms/hash/hamsi.js`](../../../algorithms/hash/hamsi.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 32 bytes (256 bits) |

## Security

**Status:** 📰 Obsolete

No vulnerabilities are recorded for this implementation.

## Documentation

- [Hamsi Specification](https://www.cosic.esat.kuleuven.be/hamsi/)
- [Hamsi Submission Package (NIST SHA-3 Round 2)](https://csrc.nist.gov/CSRC/media/Projects/Hash-Functions/documents/Hamsi_Round2.zip)
- [sphlib Reference Implementation](https://github.com/pornin/sphlib/blob/master/c/hamsi.c)
- [NIST SHA-3 Competition](https://csrc.nist.gov/projects/hash-functions/sha-3-project)

## References

- [Distinguishers for the Compression Function and Output Transformation of Hamsi-256](https://eprint.iacr.org/2010/091.pdf)
- [sphlib test vectors (test_hamsi.c)](https://github.com/pornin/sphlib/blob/master/c/test_hamsi.c)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST Vector #1 (0 bits)](https://github.com/pornin/sphlib/blob/master/c/test_hamsi.c)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `750e9ec469f4db626bee7e0c10ddaa1bd01fe194b94efbabebd24764dc2b13e9` |

---

[← All algorithms](../README.md)
