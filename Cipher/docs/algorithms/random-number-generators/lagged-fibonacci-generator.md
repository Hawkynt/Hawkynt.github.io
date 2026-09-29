# Lagged Fibonacci Generator

> The Lagged Fibonacci Generator is a pseudo-random number generator based on the generalized Fibonacci recurrence X[n] = (X[n-j] ⊙ X[n-k]) mod m. Commonly uses additive or subtractive operations with lags like (55,24) or (100,37). Fast and widely used but not cryptographically secure.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Deterministic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Donald Knuth (TAOCP popularization) |
| Year | 1997 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/lagged-fibonacci.js`](../../../algorithms/random/lagged-fibonacci.js) |

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

- [The Art of Computer Programming Vol. 2 (TAOCP) Section 3.6](https://www-cs-faculty.stanford.edu/~knuth/taocp.html)
- [Knuth FLRNG Reference Implementation (Fortran)](https://github.com/marcoxa/Knuth-FLRNG)
- [Wikipedia: Lagged Fibonacci Generator](https://en.wikipedia.org/wiki/Lagged_Fibonacci_generator)
- [TestU01 Statistical Testing Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)

## References

- [Parallel Additive Lagged-Fibonacci Random Number Generators (1995)](https://dl.acm.org/doi/pdf/10.1145/237578.237591)
- [R Documentation: RNG (uses Lagged Fibonacci)](https://stat.ethz.ch/R-manual/R-devel/library/base/html/Random.html)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Additive LFG(56,0,31) with seed 0: First 8 outputs (64 bytes)](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `operationMode` | additive |
| `stateSize` | `56` |
| `shortLag` | `0` |
| `longLag` | `31` |
| `outputSize` | `64` |
| `input` | `null` |
| `expected` | `6e2b270f55bbd9cbbe8f229a0ff0fd69 8a430423d94979b1d766fcbc25827cfa 50bfb1219b6256e68cdbb5a71ade3d8b ef555e79ac7f597d883deadf8941fd1b` |

**Vector 2** — [Additive LFG(56,0,31) with seed 1: First 5 outputs (40 bytes)](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000001` |
| `operationMode` | additive |
| `stateSize` | `56` |
| `shortLag` | `0` |
| `longLag` | `31` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `2b440a8129b79edde2179fe86c5ab5af e080f26c03d0eb10a10aa381f5b9f82d 936be653bd04cd1a` |

**Vector 3** — [Subtractive LFG(56,0,31) with seed 42: First 5 outputs (40 bytes)](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `000000000000002a` |
| `operationMode` | subtractive |
| `stateSize` | `56` |
| `shortLag` | `0` |
| `longLag` | `31` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `5d1e3eb40aaea7ba3e7e3396389d12f7 3ef9fe630d996aadedfb62f25c34a10a 5532868cab023e14` |

**Vector 4** — [XOR LFG(56,0,31) with seed 1234567: First 5 outputs (40 bytes)](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `000000000012d687` |
| `operationMode` | xor |
| `stateSize` | `56` |
| `shortLag` | `0` |
| `longLag` | `31` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `66f0d01c5164976d5268a9a206681b44 8116e1454f567576e04c5db1b8743592 400afd37d1cc0a8d` |

**Vector 5** — [Multiplicative LFG(56,0,31) with seed 42: First 5 outputs (40 bytes)](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `000000000000002a` |
| `operationMode` | multiplicative |
| `stateSize` | `56` |
| `shortLag` | `0` |
| `longLag` | `31` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `49a85f3e89dad777781c458423f14634 25eeb35e0f4788d66d99b848395acfab 801d649c534714ac` |

---

[← All algorithms](../README.md)
