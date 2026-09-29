# Cascade(Serpent,AES-256)

> Sequential chaining of Serpent and Rijndael (AES) block ciphers. Encrypts with Serpent first, then Rijndael (AES). Provides increased security margin through cipher diversity.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher Construction |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Jack Lloyd (Botan Library) |
| Year | 2010 |
| Origin | Not specified |
| Source | [`algorithms/block/cascade.js`](../../../algorithms/block/cascade.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 64 bytes (512 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Botan CASCADE Implementation (Header)](https://github.com/randombit/botan/blob/master/src/lib/block/cascade/cascade.h)
- [Botan CASCADE Implementation (Source)](https://github.com/randombit/botan/blob/master/src/lib/block/cascade/cascade.cpp)
- [Botan Test Vectors](https://github.com/randombit/botan/blob/master/src/tests/data/block/cascade.vec)

## References

- [Cipher Cascading - Wikipedia](https://en.wikipedia.org/wiki/Multiple_encryption)
- [Botan Cryptography Library](https://botan.randombit.net/)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Botan cascade.vec - Cascade(Serpent,AES-256) vector 1](https://github.com/randombit/botan/blob/master/src/tests/data/block/cascade.vec)

| Field | Value |
| --- | --- |
| `key` | `ee426051d1adce09ac02e2023331f273 bb1b2c4c5905deda3e1032ccd0db5611 5b011f05688f781e3f790364968e06dc 6e7bd5fa38db068cbd34a85b6b3a9458` |
| `input` | `06ceb2b4fd2f0a27b3c90d77d2e9bbd3 665a8dcac9187b1ee9f6a60d39042a9d 3719883b3e87845b9d4a8be258379959 775969cbf5768a359797b2fa19fc2fcc` |
| `expected` | `05ffbf6e8097fc746ffad8c3306e6db6 68148796180f26ca5de06ae76de16d07 8a0e72b259982423ed96ff95719deb16 0cefe7697752b0cfa984a18ddcef2ec0` |

**Vector 2** — [Botan cascade.vec - Cascade(Serpent,AES-256) vector 2](https://github.com/randombit/botan/blob/master/src/tests/data/block/cascade.vec)

| Field | Value |
| --- | --- |
| `key` | `cdcd23f5518db5dae8c69b56eb352d4f 3c4a64a5ffc8e5bc2511b8310993c48e fa30a0f9e2b98a0fb1fe64173e6a8038 047aebae22e17392fe32cf1d0de3bb76` |
| `input` | `fbaf0de6c09d10eb31f21a7c784bf453 f82f51effa8b363ee6b33df15204f434 45170ded1e39ab922548ed82aaaded6b f470a5226b69d025fe3d532aadda069c 464d2c8a65e1a18698bd521afb305322 9c1539626392031f8c36229ff3178a7f 5c716e30dbefddd4ac2113071977b795 a8b29da7f467471a996fb63136387c28` |
| `expected` | `7ed1f730eed52dfb63e073a40eae404e 443aceb9a3b55132e740ace1eedf99d0 f22b3f2326e2e124594e75ed1915c8d1 55f24269254b22b6e8c53e9f64e70552 d5e3004782c6c47341ebf8716b59dab4 9b512b6df7f9d7fb914ffa56f7f89b56 1b6a5dfe9334b7561144b25fe0f57beb b4058ec7d9eea57ab62825a86312bbc3` |

---

[← All algorithms](../README.md)
