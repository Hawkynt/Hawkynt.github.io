# BLAKE3

> Modern cryptographic hash function based on BLAKE2. Splits the message into 1024-byte chunks, hashes each to a chaining value and combines them with a binary Merkle tree of parent nodes, reproducing the official test vectors at every input length. The digest is extendable to any length.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Cryptographic Hash |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Jack O'Connor, Jean-Philippe Aumasson, Samuel Neves, Zooko Wilcox-O'Hearn |
| Year | 2020 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/hash/blake3.js`](../../../algorithms/hash/blake3.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 32 bytes (256 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [BLAKE3 Specification](https://github.com/BLAKE3-team/BLAKE3-specs/blob/master/blake3.pdf)
- [BLAKE3 Official Website](https://blake3.io/)
- [Wikipedia BLAKE3](https://en.wikipedia.org/wiki/BLAKE_(hash_function)#BLAKE3)

## References

- [BLAKE3 Reference Implementation](https://github.com/BLAKE3-team/BLAKE3)
- [BLAKE3 Rust Implementation](https://crates.io/crates/blake3)

## Test vectors

11 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [BLAKE3 Official Test Vector - Empty string (0 bytes)](https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262` |

**Vector 2** — [BLAKE3 Official Test Vector - 3 bytes [0,1,2]](https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json)

| Field | Value |
| --- | --- |
| `input` | `000102` |
| `expected` | `e1be4d7a8ab5560aa4199eea339849ba8e293d55ca0a81006726d184519e647f` |

**Vector 3** — [BLAKE3 Official Test Vector - 7 bytes [0,1,2,3,4,5,6]](https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json)

| Field | Value |
| --- | --- |
| `input` | `00010203040506` |
| `expected` | `3f8770f387faad08faa9d8414e9f449ac68e6ff0417f673f602a646a891419fe` |

**Vector 4** — [BLAKE3 Official Test Vector - 63 bytes](https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e` |
| `expected` | `e9bc37a594daad83be9470df7f7b3798297c3d834ce80ba85d6e207627b7db7b` |

**Vector 5** — [BLAKE3 Official Test Vector - 64 bytes (exact block boundary)](https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `4eed7141ea4a5cd4b788606bd23f46e212af9cacebacdc7d1f4c6dc7f2511b98` |

**Vector 6** — [BLAKE3 Official Test Vector - 65 bytes](https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 40` |
| `expected` | `de1e5fa0be70df6d2be8fffd0e99ceaa8eb6e8c93a63f2d8d1c30ecb6b263dee` |

**Vector 7** — [BLAKE3 Official Test Vector - 128 bytes (exact block boundary)](https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f` |
| `expected` | `f17e570564b26578c33bb7f44643f539624b05df1a76c81f30acd548c44b45ef` |

**Vector 8** — [BLAKE3 Official Test Vector - 1024 bytes (exact chunk boundary)](https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (1024 bytes; the full value is in the source) |
| `expected` | `42214739f095a406f3fc83deb889744ac00df831c10daa55189b5d121c855af7` |

**Vector 9** — [BLAKE3 Official Test Vector - 1025 bytes (two chunks, one parent)](https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (1025 bytes; the full value is in the source) |
| `expected` | `d00278ae47eb27b34faecf67b4fe263f82d5412916c1ffd97c8cb7fb814b8444` |

**Vector 10** — [BLAKE3 Official Test Vector - 2049 bytes (three chunks, unbalanced tree)](https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (2049 bytes; the full value is in the source) |
| `expected` | `5f4d72f40d7a5f82b15ca2b2e44b1de3c2ef86c426c95c1af0b6879522563030` |

**Vector 11** — [BLAKE3 Official Test Vector - 1025 bytes, 131 byte extended output](https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json)

| Field | Value |
| --- | --- |
| `outputSize` | `131` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (1025 bytes; the full value is in the source) |
| `expected` | `d00278ae47eb27b34faecf67b4fe263f 82d5412916c1ffd97c8cb7fb814b8444 f4c4a22b4b399155358a994e52bf255d e60035742ec71bd08ac275a1b51cc6bf e332b0ef84b409108cda080e6269ed4b 3e2c3f7d722aa4cdc98d16deb554e562 7be8f955c98e1d5f9565a9194cad0c42 85f93700062d9595adb992ae68ff1280 0ab67a` |

---

[← All algorithms](../README.md)
