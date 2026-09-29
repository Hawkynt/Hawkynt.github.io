# SplitMix32

> SplitMix32 is a fast 32-bit splittable PRNG based on MurmurHash3's fmix32 finalizer. It uses a Weyl sequence with golden ratio constant combined with improved mixing functions. Commonly used to seed other PRNGs like xoroshiro and xoshiro.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Deterministic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Guy L. Steele Jr., Doug Lea, Christine H. Flood |
| Year | 2014 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/splitmix32.js`](../../../algorithms/random/splitmix32.js) |

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

- [Original Paper: Fast Splittable Pseudorandom Number Generators (OOPSLA 2014)](https://dl.acm.org/doi/10.1145/2714064.2660195)
- [SplitMix32 JavaScript Implementation (attilabuti)](https://github.com/attilabuti/SimplexNoise)
- [MurmurHash3 fmix32 Finalizer](https://github.com/aappleby/smhasher/blob/master/src/MurmurHash3.cpp)
- [Haskell splitmix Package (32-bit variant)](https://hackage.haskell.org/package/splitmix/docs/System-Random-SplitMix32.html)

## References

- [JavaScript PRNGs Collection (bryc)](https://github.com/bryc/code/blob/master/jshash/PRNGs.md)
- [Seeding Random Generators with SplitMix](https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript)
- [PCG: Bugs in SplitMix Discussion](https://www.pcg-random.org/posts/bugs-in-splitmix.html)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed 0: First 5 outputs (20 bytes) - verified against reference implementation](https://github.com/attilabuti/SimplexNoise)

| Field | Value |
| --- | --- |
| `seed` | `00000000` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `64625032d9c0799caf362e107fa88912c4671b39` |

**Vector 2** — [Seed 1: First 5 outputs (20 bytes) - single-bit seed difference](https://github.com/attilabuti/SimplexNoise)

| Field | Value |
| --- | --- |
| `seed` | `00000001` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `5e2d177214e498f0d20ea1fdb382f3392660b860` |

**Vector 3** — [Seed 42: First 8 outputs (32 bytes) - commonly used test seed](https://github.com/attilabuti/SimplexNoise)

| Field | Value |
| --- | --- |
| `seed` | `0000002a` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `20e448180895a9231339a01fb4e3841a361f702a9ddbcdcf03ae3c3c6f22ac67` |

**Vector 4** — [Seed 12345: First 5 outputs (20 bytes) - larger seed value](https://github.com/attilabuti/SimplexNoise)

| Field | Value |
| --- | --- |
| `seed` | `00003039` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `c3b24a19248b6df5af4b77241ec7438dcbcf9585` |

**Vector 5** — [Seed 0xFFFFFFFF (max 32-bit): First 5 outputs (20 bytes) - edge case](https://github.com/attilabuti/SimplexNoise)

| Field | Value |
| --- | --- |
| `seed` | `ffffffff` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `eb721c8affe8bd344da2a8cea4a5cc85c85a6be7` |

---

[← All algorithms](../README.md)
