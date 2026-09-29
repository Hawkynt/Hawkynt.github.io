# Subterranean-Hash

> Lightweight cryptographic hash function designed by Joan Daemen based on a 257-bit permutation. Finalist in NIST's Lightweight Cryptography standardization process offering efficient hashing for resource-constrained environments.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Hash Function |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Joan Daemen |
| Year | 2017 |
| Origin | 🌐 International |
| Source | [`algorithms/hash/subterranean-hash.js`](../../../algorithms/hash/subterranean-hash.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 32 bytes (256 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [Official Website](https://cs.ru.nl/~joan/subterranean.html)
- [NIST LWC Submission](https://csrc.nist.gov/Projects/lightweight-cryptography/round-2-candidates)
- [Specification (PDF)](https://cs.ru.nl/~joan/papers/Subterranean-2.pdf)

## References

- [Rhys Weatherley's Lightweight Cryptography Primitives - Subterranean implementation](https://github.com/rweather/lightweight-crypto)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST LWC KAT - Empty message](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Subterranean-Hash.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `4de2b673c183d1031bbba5fb63cc15270daafbbe1f77fa7fbeaf1d17cf694feb` |

**Vector 2** — [NIST LWC KAT - Single zero byte](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Subterranean-Hash.txt)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `91e6735eb598b7fad5ea99eea59dc9524c1bdd1ff864108cb5011c28e6572afb` |

**Vector 3** — [NIST LWC KAT - Two bytes (00 01)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Subterranean-Hash.txt)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `7e59e39b3addce9632836d7ea47bbdf28b37566ff7307ba5f235737d8d71d908` |

**Vector 4** — [NIST LWC KAT - Three bytes (00 01 02)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Subterranean-Hash.txt)

| Field | Value |
| --- | --- |
| `input` | `000102` |
| `expected` | `5dc635642f27a2bfc259373e58894fb4220aab502dc7e5d79b95a657c098f0d4` |

**Vector 5** — [NIST LWC KAT - Four bytes (00 01 02 03)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Subterranean-Hash.txt)

| Field | Value |
| --- | --- |
| `input` | `00010203` |
| `expected` | `b6f84fcc1c4cf0af391136baa0b9eca326840e8602773354f3d4d63ecc711a48` |

**Vector 6** — [NIST LWC KAT - 16 bytes](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/Subterranean-Hash.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `e5dc937f458a9cf4064473e20c3f9ac0970ed71852af636ade8b48c5c1af4717` |

---

[← All algorithms](../README.md)
