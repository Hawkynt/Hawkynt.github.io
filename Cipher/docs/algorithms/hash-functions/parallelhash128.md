# ParallelHash128

> ParallelHash128 is a parallel hash function from NIST SP 800-185 that supports efficient hashing of very long strings using parallelism. Based on cSHAKE128.

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
| Output sizes | 1 byte (8 bits) to 1024 bytes (8192 bits) |

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

**Vector 1** — [ParallelHash128: Sample #1 (B=8, S='', 32 bytes) - NIST](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/ParallelHash_samples.pdf)

| Field | Value |
| --- | --- |
| `blockSize` | `8` |
| `customization` | _(empty)_ |
| `outputSize` | `32` |
| `input` | `000102030405060710111213141516172021222324252627` |
| `expected` | `ba8dc1d1d979331d3f813603c67f72609ab5e44b94a0b8f9af46514454a2b4f5` |

**Vector 2** — [ParallelHash128: Sample #2 (B=8, S='Parallel Data', 32 bytes) - NIST](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/ParallelHash_samples.pdf)

| Field | Value |
| --- | --- |
| `blockSize` | `8` |
| `customization` | `506172616c6c656c2044617461` |
| `outputSize` | `32` |
| `input` | `000102030405060710111213141516172021222324252627` |
| `expected` | `fc484dcb3f84dceedc353438151bee58157d6efed0445a81f165e495795b7206` |

**Vector 3** — [ParallelHash128: Sample #3 (B=12, S='Parallel Data', 32 bytes) - NIST](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/ParallelHash_samples.pdf)

| Field | Value |
| --- | --- |
| `blockSize` | `12` |
| `customization` | `506172616c6c656c2044617461` |
| `outputSize` | `32` |
| `input` | `000102030405060708090a0b10111213 1415161718191a1b2021222324252627 28292a2b303132333435363738393a3b 404142434445464748494a4b50515253 5455565758595a5b` |
| `expected` | `f7fd5312896c6685c828af7e2adb97e393e7f8d54e3c2ea4b95e5aca3796e8fc` |

**Vector 4** — [ParallelHash128: XOF mode (B=12, S='Parallel Data', 32 bytes)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/ParallelHashTest.java)

| Field | Value |
| --- | --- |
| `blockSize` | `12` |
| `customization` | `506172616c6c656c2044617461` |
| `outputSize` | `32` |
| `xofMode` | Yes |
| `input` | `000102030405060708090a0b10111213 1415161718191a1b2021222324252627 28292a2b303132333435363738393a3b 404142434445464748494a4b50515253 5455565758595a5b` |
| `expected` | `0127ad9772ab904691987fcc4a24888f341fa0db2145e872d4efd255376602f0` |

---

[← All algorithms](../README.md)
