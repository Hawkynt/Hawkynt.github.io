# MurmurHash3

> Fast non-cryptographic hash function with excellent distribution properties. Designed for hash tables, bloom filters, and general purpose hashing.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Fast Hash |
| Security status | 🎓 Educational Only |
| Complexity | Not specified |
| Inventor | Austin Appleby |
| Year | 2008 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/hash/murmurhash3.js`](../../../algorithms/hash/murmurhash3.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 4 bytes (32 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [MurmurHash3 Original Repository](https://github.com/aappleby/MurmurHash)
- [SMHasher Test Suite](https://github.com/aappleby/smhasher)
- [Wikipedia MurmurHash](https://en.wikipedia.org/wiki/MurmurHash)

## References

- [smhasher (MurmurHash3.cpp reference implementation)](https://github.com/aappleby/smhasher)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [MurmurHash3 Empty String](https://github.com/aappleby/smhasher)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [MurmurHash3 Single character 'a'](https://github.com/aappleby/smhasher)

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `3c2569b2` |

**Vector 3** — [MurmurHash3 Short string 'abc'](https://github.com/aappleby/smhasher)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `b3dd93fa` |

---

[← All algorithms](../README.md)
