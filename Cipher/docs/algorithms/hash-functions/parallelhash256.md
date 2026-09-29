# ParallelHash256

> ParallelHash256 is a parallel hash function from NIST SP 800-185 that supports efficient hashing of very long strings using parallelism. Based on cSHAKE256.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Parallel Hash Function |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | NIST |
| Year | 2016 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/hash/parallelhash.js`](../../../algorithms/hash/parallelhash.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Hash sizes | 1 byte (8 bits) to 1024 bytes (8192 bits) |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST SP 800-185](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-185.pdf)
- [NIST Examples](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/ParallelHash_samples.pdf)

## References

- [BouncyCastle Implementation](https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/digests/ParallelHash.java)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ParallelHash256: Sample #1 (B=8, S='', 64 bytes) - NIST](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/ParallelHash_samples.pdf)

| Field | Value |
| --- | --- |
| `blockSize` | `8` |
| `customization` | _(empty)_ |
| `outputSize` | `64` |
| `input` | `000102030405060710111213141516172021222324252627` |
| `expected` | `bc1ef124da34495e948ead207dd98422 35da432d2bbc54b4c110e64c45110553 1b7f2a3e0ce055c02805e7c2de1fb746 af97a1dd01f43b824e31b87612410429` |

**Vector 2** — [ParallelHash256: Sample #2 (B=8, S='Parallel Data', 64 bytes) - NIST](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/ParallelHash_samples.pdf)

| Field | Value |
| --- | --- |
| `blockSize` | `8` |
| `customization` | `506172616c6c656c2044617461` |
| `outputSize` | `64` |
| `input` | `000102030405060710111213141516172021222324252627` |
| `expected` | `cdf15289b54f6212b4bc270528b49526 006dd9b54e2b6add1ef6900dda3963bb 33a72491f236969ca8afaea29c682d47 a393c065b38e29fae651a2091c833110` |

**Vector 3** — [ParallelHash256: Sample #3 (B=12, S='Parallel Data', 64 bytes) - NIST](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/ParallelHash_samples.pdf)

| Field | Value |
| --- | --- |
| `blockSize` | `12` |
| `customization` | `506172616c6c656c2044617461` |
| `outputSize` | `64` |
| `input` | `000102030405060708090a0b10111213 1415161718191a1b2021222324252627 28292a2b303132333435363738393a3b 404142434445464748494a4b50515253 5455565758595a5b` |
| `expected` | `69d0fcb764ea055dd09334bc6021cb7e 4b61348dff375da262671cdec3effa8d 1b4568a6cce16b1cad946ddde27f6ce2 b8dee4cd1b24851ebf00eb90d43813e9` |

**Vector 4** — [ParallelHash256: XOF mode (B=12, S='Parallel Data', 64 bytes)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/ParallelHashTest.java)

| Field | Value |
| --- | --- |
| `blockSize` | `12` |
| `customization` | `506172616c6c656c2044617461` |
| `outputSize` | `64` |
| `xofMode` | Yes |
| `input` | `000102030405060708090a0b10111213 1415161718191a1b2021222324252627 28292a2b303132333435363738393a3b 404142434445464748494a4b50515253 5455565758595a5b` |
| `expected` | `6b3e790b330c889a204c2fbc728d809f 19367328d852f4002dc829f73afd6bce fb7fe5b607b13a801c0be5c1170bdb79 4e339458fdb0e62a6af3d42558970249` |

---

[← All algorithms](../README.md)
