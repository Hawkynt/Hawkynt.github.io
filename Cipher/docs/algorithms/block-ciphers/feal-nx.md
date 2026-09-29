# FEAL-NX

> Fast Data Encipherment Algorithm NX variant by NTT with 128-bit keys. Educational implementation of a cryptographically broken Feistel cipher with variable rounds (default 32), 64-bit blocks and 128-bit keys.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | ❌ Broken |
| Complexity | Intermediate |
| Inventor | Akihiro Shimizu, Shoji Miyaguchi |
| Year | 1990 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/block/feal-nx.js`](../../../algorithms/block/feal-nx.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Differential Cryptanalysis](https://en.wikipedia.org/wiki/Differential_cryptanalysis) | FEAL-NX can be broken with differential cryptanalysis for N &lt;= 31 rounds. Requires N > 31 for security against known attacks. | — |

## Documentation

- [FEAL Cipher Family](https://en.wikipedia.org/wiki/FEAL)
- [The FEAL Cipher Family (CRYPTO 1990)](https://link.springer.com/chapter/10.1007/BFb0083866)
- [Handbook of Applied Cryptography Chapter 7](http://koclab.cs.ucsb.edu/teaching/cs178/docx/d-chap07.pdf)

## References

- [Differential Cryptanalysis of FEAL](https://link.springer.com/chapter/10.1007/3-540-46877-3_35)
- [Linear Cryptanalysis of FEAL-8X](https://link.springer.com/chapter/10.1007/978-3-319-13051-4_4)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [FEAL-NX test vector #1 (32 rounds)](https://github.com/zilijonas/FEAL-NX/blob/master/test-vectors.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `rounds` | `32` |
| `input` | `0000000100020003` |
| `expected` | `0309e94066035e24` |

**Vector 2** — [FEAL-NX test vector #2 (32 rounds)](https://github.com/zilijonas/FEAL-NX/blob/master/test-vectors.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `rounds` | `32` |
| `input` | `0001000200030004` |
| `expected` | `f158cba2fbdb6747` |

**Vector 3** — [FEAL-NX test vector #3 (32 rounds)](https://github.com/zilijonas/FEAL-NX/blob/master/test-vectors.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `rounds` | `32` |
| `input` | `0002000300040005` |
| `expected` | `07a44b91188fb722` |

---

[← All algorithms](../README.md)
