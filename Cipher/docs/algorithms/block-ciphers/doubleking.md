# DoubleKing

> 384-bit block cipher with 384-bit key using 32-bit words. BaseKing variant designed by Tim van Dijk for ARM architecture efficiency. Uses 11 rounds plus final transformation.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Tim van Dijk |
| Year | 2017 |
| Origin | 🇳🇱 Netherlands |
| Source | [`algorithms/block/doubleking.js`](../../../algorithms/block/doubleking.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 48 bytes (384 bits) |
| Block sizes | 48 bytes (384 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [Tim van Dijk's Bachelor Thesis](https://www.cs.ru.nl/bachelors-theses/2017/Tim_van_Dijk___4477073___A_high-performance_threshold_implementation_of_a_BaseKing_variant_on_an_ARM_architecture.pdf)
- Joan Daemen's Doctoral Dissertation — Cipher and hash function design strategies based on linear and differential cryptanalysis

## References

- [Joan Daemen Research Page](https://cs.ru.nl/~joan/JoanDaemenResearch.html)
- Tim van Dijk's Python Reference Implementation — DoubleKing.py from Bachelor thesis

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — All zeros test vector

Source: Tim van Dijk's Python reference implementation

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `76eb5142993436915c1ee6a439b26f27 e84c37b317e80df0ae5519021e126855 4d76749ce0ff804a4ea3e77cd5870cd4` |

**Vector 2** — All ones test vector

Source: Tim van Dijk's Python reference implementation

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff` |
| `input` | `ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff` |
| `expected` | `a8a0b4a183ea178ffb4a1d886cbb415a b7c81abf184f73658a8ab72fbad0b666 0ec77ba50c865d262c6cb47507920b60` |

**Vector 3** — Sequential pattern test vector

Source: Tim van Dijk's Python reference implementation

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f` |
| `expected` | `98c7ae8f9368cc678887c00509f089e3 62ef2f2ff303cfd17ea02296162eacb1 530310843b44c1cf15493998cb4af2b3` |

---

[← All algorithms](../README.md)
