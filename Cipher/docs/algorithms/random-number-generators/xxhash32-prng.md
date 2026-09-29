# XXHash32 PRNG

> Fast non-cryptographic PRNG based on XXHash32 mixing function, designed by Yann Collet. Uses XXHash32 finalizer for high-quality bit mixing with minimal state. Excellent speed and distribution properties for simulation and testing applications.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Hash-Based PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Yann Collet (XXHash) |
| Year | 2012 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/random/xxhash32.js`](../../../algorithms/random/xxhash32.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 1 byte (8 bits) to 4 bytes (32 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [XXHash Official Repository (Yann Collet)](https://github.com/Cyan4973/xxHash)
- [XXHash Specification (NIST-style documentation)](https://github.com/Cyan4973/xxHash/blob/dev/doc/xxhash_spec.md)
- [XXHash Homepage](https://www.xxhash.com)
- [Wikipedia: xxHash](https://en.wikipedia.org/wiki/XxHash)

## References

- [Hash-Based PRNGs (PractRand)](http://pracrand.sourceforge.net/)
- [SMHasher Test Suite](https://github.com/rurban/smhasher)
- [Fast Non-Cryptographic Hash Functions](https://aras-p.info/blog/2016/08/09/More-Hash-Function-Tests/)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed 0: First 5 outputs (20 bytes) - verified against XXHash32 reference](https://github.com/Cyan4973/xxHash/blob/dev/doc/xxhash_spec.md)

| Field | Value |
| --- | --- |
| `seed` | `00000000` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `0ab656ac82724c0ed3671dd6a0f55055643a0950` |

**Vector 2** — [Seed 1: First 5 outputs (20 bytes) - single-bit seed difference](https://github.com/Cyan4973/xxHash)

| Field | Value |
| --- | --- |
| `seed` | `00000001` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `457f061bdc17b1d66cf5b9c576cdea3599019835` |

**Vector 3** — [Seed 42: First 5 outputs (20 bytes) - commonly used test seed](https://www.xxhash.com)

| Field | Value |
| --- | --- |
| `seed` | `0000002a` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `05b53c5f98e65c749afbb51ee4975debe497495f` |

**Vector 4** — [Seed 0xDEADBEEF: First 5 outputs (20 bytes) - edge case](https://github.com/Cyan4973/xxHash/blob/dev/xxhash.c)

| Field | Value |
| --- | --- |
| `seed` | `deadbeef` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `ec99cb63b2f96d4d93c66585be27dfa9682cbb3f` |

**Vector 5** — [Seed 12345: First 5 outputs (20 bytes) - larger seed value](https://github.com/Cyan4973/xxHash)

| Field | Value |
| --- | --- |
| `seed` | `00003039` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `6357aaafbb22dcb3f7142ec87c349aa117d64c25` |

---

[← All algorithms](../README.md)
