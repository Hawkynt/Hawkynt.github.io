# FEAL-8

> Fast Data Encipherment Algorithm by NTT. Educational implementation of a cryptographically broken Feistel cipher with 8 rounds, 64-bit blocks and keys.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | ❌ Broken |
| Complexity | Beginner |
| Inventor | Akihiro Shimizu, Shoji Miyaguchi |
| Year | 1987 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/block/feal.js`](../../../algorithms/block/feal.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 8 bytes (64 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Differential Cryptanalysis](https://en.wikipedia.org/wiki/Differential_cryptanalysis) | FEAL-8 can be broken with differential cryptanalysis using only a few hundred chosen plaintexts | — |

## Documentation

- [FEAL-8 Specification](https://en.wikipedia.org/wiki/FEAL)
- [Original EUROCRYPT 1987 Paper](https://link.springer.com/chapter/10.1007/3-540-39118-5_24)

## References

- [Differential Cryptanalysis of FEAL](https://link.springer.com/chapter/10.1007/3-540-46877-3_35)
- [FEAL Cryptanalysis](https://www.iacr.org/archive/crypto1989/000350213.pdf)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Handbook of Applied Cryptography, Example 7.99 (FEAL-8)](https://cacr.uwaterloo.ca/hac/about/chap7.pdf)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdef` |
| `input` | `0000000000000000` |
| `expected` | `ceef2c86f2490752` |

---

[← All algorithms](../README.md)
