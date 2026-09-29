# Threefry2x64-20

> Counter-based PRNG using Threefish block cipher round function. Trivially parallelizable with 2^128 period, passes all TestU01 statistical tests. Part of the Random123 library by D. E. Shaw Research.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Counter-Based PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | John K. Salmon, Mark A. Moraes, Ron O. Dror, David E. Shaw |
| Year | 2011 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/threefry.js`](../../../algorithms/random/threefry.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |
| `IsCounterBased` | Yes |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Original Paper: Parallel Random Numbers: As Easy as 1, 2, 3 (SC11, 2011)](https://www.thesalmons.org/john/random123/papers/random123sc11.pdf)
- [Random123 Library Documentation](https://www.thesalmons.org/john/random123/releases/latest/docs/index.html)
- [Random123 GitHub Repository](https://github.com/DEShawResearch/random123)
- [Threefry Header Reference](https://www.thesalmons.org/john/random123/releases/1.08/docs/threefry_8h_source.html)

## References

- [TestU01 Statistical Testing Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)
- [Threefish Block Cipher Specification](https://www.schneier.com/academic/skein/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Threefry2x64-20: Counter=0, Key=0 - Random123 kat_vectors](https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `outputSize` | `16` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `6598c6c2a8e3b6c24d0850f342ed816f` |

**Vector 2** — [Threefry2x64-20: Counter=0xFFFFFFFFFFFFFFFF (all), Key=0xFFFFFFFFFFFFFFFF (all) - Random123 kat_vectors](https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffffffffffffffff` |
| `outputSize` | `16` |
| `input` | `ffffffffffffffffffffffffffffffff` |
| `expected` | `7a275dd9c4b72ce0688b3b89d03366d0` |

**Vector 3** — [Threefry2x64-20: Counter=π digits, Key=π digits - Random123 kat_vectors](https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors)

| Field | Value |
| --- | --- |
| `key` | `d0319f29223809a4896c4eec98fa2e08` |
| `outputSize` | `16` |
| `input` | `d308a385886a3f24447370032e8a1913` |
| `expected` | `f10a0fbb307d3c26261531d36183be56` |

---

[← All algorithms](../README.md)
