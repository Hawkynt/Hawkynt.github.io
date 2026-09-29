# KNOT-HASH-256-384

> Lightweight hash function based on bit-sliced PRESENT-like permutations, finalist in NIST Lightweight Cryptography competition. Uses KNOT-384 permutation with 256-bit output.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Lightweight Hash |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Zheng Gong, Guohong Liao, Ling Song, Keting Jia, Lei Hu |
| Year | 2019 |
| Origin | 🇨🇳 China |
| Source | [`algorithms/hash/knot-hash.js`](../../../algorithms/hash/knot-hash.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 32 bytes (256 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [KNOT Specification (NIST LWC)](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/knot-spec-final.pdf)
- [NIST Lightweight Cryptography](https://csrc.nist.gov/projects/lightweight-cryptography)
- [KNOT Official Website](https://www.knotcipher.com/)

## References

- [rweather/lightweight-crypto (KNOT reference implementation)](https://github.com/rweather/lightweight-crypto)

## Test vectors

10 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [KNOT-HASH-256-384: Empty message (NIST KAT Count=1)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-256-384.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `5025252949bf0ebf9d750d2e11ab5c75e4f7b8dca426b58ea2ae52a857653e04` |

**Vector 2** — [KNOT-HASH-256-384: Single zero byte (NIST KAT Count=2)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-256-384.txt)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `c15c34623e347c0d3f73b84d8f1706f4f95c5640a1ab8db43fd7b07e07ad0397` |

**Vector 3** — [KNOT-HASH-256-384: Two bytes (NIST KAT Count=3)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-256-384.txt)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `53ca8ec8bfbb0610154c86019bdbb45c70706696120233d61ec1199bccad8cd3` |

**Vector 4** — [KNOT-HASH-256-384: Three bytes (NIST KAT Count=4)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-256-384.txt)

| Field | Value |
| --- | --- |
| `input` | `000102` |
| `expected` | `9e6908918b5445ffac8321b0d8eb83a47d0c2c858cdad1dbc81db70f9df012ed` |

**Vector 5** — [KNOT-HASH-256-384: Four bytes (NIST KAT Count=5)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-256-384.txt)

| Field | Value |
| --- | --- |
| `input` | `00010203` |
| `expected` | `21ef8a4c2e600a3d2b40de5a80e6ba4b664116a1383f26ef95ad1892be649cd5` |

**Vector 6** — [KNOT-HASH-256-384: Eight bytes (NIST KAT Count=9)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-256-384.txt)

| Field | Value |
| --- | --- |
| `input` | `0001020304050607` |
| `expected` | `df3dbefa6ab5194e5692c7fef78c442f6a6feaf262adb5f3630682b58fe3766f` |

**Vector 7** — [KNOT-HASH-256-384: 16 bytes (NIST KAT Count=17)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-256-384.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `b3f056368184838cc83dfb0e7466e439a010743ae7c03e55022d116b5c3733b3` |

**Vector 8** — [KNOT-HASH-256-384: 32 bytes (NIST KAT Count=33)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-256-384.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `4968d39797d02a81928e67b085e06f5c9dfb44a1fd8d49f3029b9af126783b54` |

**Vector 9** — [KNOT-HASH-256-384: 48 bytes (NIST KAT Count=49)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-256-384.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f` |
| `expected` | `8d818b7b903ba04a94cf0992b89a2988ba086c339096d16dfd636b4a3f7bd743` |

**Vector 10** — [KNOT-HASH-256-384: 64 bytes (NIST KAT Count=65)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-256-384.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `c38b93aac496b1376a1e53e7a82a2836a5141a08bc91f48291d1446921a535b8` |

---

[← All algorithms](../README.md)
