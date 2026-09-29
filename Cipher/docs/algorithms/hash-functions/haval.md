# HAVAL

> HAVAL (HAsh of Variable Length) is a cryptographic hash function with variable output length (128, 160, 192, 224, 256 bits) and variable passes (3, 4, 5).

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Variable Hash |
| Security status | Not classified |
| Complexity | Not specified |
| Inventor | Yuliang Zheng, Josef Pieprzyk, Jennifer Seberry |
| Year | 1992 |
| Origin | 🇦🇺 Australia |
| Source | [`algorithms/hash/haval.js`](../../../algorithms/hash/haval.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [HAVAL - A One-Way Hashing Algorithm with Variable Length of Output](https://web.archive.org/web/20171129084214/http://labs.calyptix.com/haval.php)
- [US Patent 5,351,310 - HAVAL](https://patents.google.com/patent/US5351310A/en)
- [Cryptanalysis of HAVAL](https://link.springer.com/chapter/10.1007/3-540-48329-2_24)

## References

- [Hash Function Cryptanalysis](https://csrc.nist.gov/projects/hash-functions)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [String 'abc' - HAVAL-128/3](https://github.com/rikyoz/MrHash/blob/master/src/haval.cpp)

| Field | Value |
| --- | --- |
| `passes` | `3` |
| `hashBits` | `128` |
| `input` | `616263` |
| `expected` | `9e40ed883fb63e985d299b40cda2b8f2` |

**Vector 2** — [String 'abc' - HAVAL-256/3](https://github.com/rikyoz/MrHash/blob/master/src/haval.cpp)

| Field | Value |
| --- | --- |
| `passes` | `3` |
| `hashBits` | `256` |
| `input` | `616263` |
| `expected` | `8699f1e3384d05b2a84b032693e2b6f46df85a13a50d93808d6874bb8fb9e86c` |

**Vector 3** — [Empty string - HAVAL-256/5](https://github.com/rikyoz/MrHash/blob/master/src/haval.cpp)

| Field | Value |
| --- | --- |
| `passes` | `5` |
| `hashBits` | `256` |
| `input` | _(empty)_ |
| `expected` | `be417bb4dd5cfb76c7126f4f8eeb1553a449039307b1a3cd451dbfdc0fbbe330` |

---

[← All algorithms](../README.md)
