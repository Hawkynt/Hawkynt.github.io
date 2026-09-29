# ACRNG (Additive Congruential RNG)

> The Additive Congruential Random Number Generator uses cascading additions through a state array, where each element is updated by adding the previous (newly updated) element. This creates a dependency chain distinct from typical lagged Fibonacci generators. Fast and simple, but not cryptographically secure.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Deterministic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Donald Knuth |
| Year | 1997 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/acrng.js`](../../../algorithms/random/acrng.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 1 byte (8 bits) to 8 bytes (64 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Knuth: The Art of Computer Programming Vol. 2, Section 3.2.2](https://www-cs-faculty.stanford.edu/~knuth/taocp.html)
- [Wikipedia: Linear Congruential Generator (Related Algorithm)](https://en.wikipedia.org/wiki/Linear_congruential_generator)
- [C# Reference Implementation](https://github.com/Hawkynt/Randomizer)

## References

- [SplitMix64 (used for state initialization)](https://prng.di.unimi.it/splitmix64.c)
- [TestU01 Statistical Testing Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ACRNG order=12, implicit modulo (2^64), seed=0: First 8 outputs (64 bytes)](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `order` | `12` |
| `modulo` | `null` |
| `outputSize` | `64` |
| `input` | `null` |
| `expected` | `80de6c41ff947f8323ada7ab849c1f4d 1829d6c3d65999983834669e0759a381 20fa987227ad02f258c87338a1c8fe2c e59e98a337cfe90519aa71a2997f1e74` |

**Vector 2** — [ACRNG order=12, implicit modulo (2^64), seed=1: First 8 outputs (64 bytes)](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000001` |
| `order` | `12` |
| `modulo` | `null` |
| `outputSize` | `64` |
| `input` | `null` |
| `expected` | `84e6e8aa35bdd945987c4da32714a28c 77396d87d11bcb5953dbf93125371bbd 052bd52374f843b24a91588a9723b6ea 4cd40d5385a95d74469279f6ad4c280f` |

**Vector 3** — [ACRNG order=12, implicit modulo (2^64), seed=42: First 8 outputs (64 bytes)](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `000000000000002a` |
| `order` | `12` |
| `modulo` | `null` |
| `outputSize` | `64` |
| `input` | `null` |
| `expected` | `7519c1f49dda4850d8aaa63cc2aae849 652d5163487f134bdf346bf650785de2 e376c4db79c67deb3bda3cffd4bcd9b9 e90e68a25e07f5271a03b3cc067a8c69` |

**Vector 4** — [ACRNG order=12, implicit modulo (2^64), seed=1234567: First 5 outputs (40 bytes)](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `000000000012d687` |
| `order` | `12` |
| `modulo` | `null` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `5cbefabf9c666daedfcfc7a2c85f1cee 695bd837c36f809268479c6444f4d82b 1d75265f5d690a31` |

**Vector 5** — [ACRNG order=5, implicit modulo (2^64), seed=42: First 5 outputs (40 bytes)](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `000000000000002a` |
| `order` | `5` |
| `modulo` | `null` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `a48f3117d94fa0e63102a4464575d185 21bd544c486ed973a3bfe0962dcf51d8 f120de0995d56ec9` |

**Vector 6** — [ACRNG order=12, modulo=2^31-1, seed=1: First 8 outputs (32 bytes)](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000001` |
| `order` | `12` |
| `modulo` | `7fffffff` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `3f8baaaf580d3e883f8eaa324cef1da87f5023482c4708441f532a983a755751` |

---

[← All algorithms](../README.md)
