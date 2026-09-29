# ICG (Inversive Congruential Generator)

> The Inversive Congruential Generator is a non-linear pseudorandom number generator that uses modular multiplicative inversion. It uses the formula X(n+1) = (a * X(n)^(-1) + c) mod m, where X(n)^(-1) is the modular multiplicative inverse. ICG has better statistical properties than LCG but is computationally more expensive.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Pseudorandom Number Generator |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Jürgen Eichenauer-Herrmann |
| Year | 1992 |
| Origin | 🇩🇪 Germany |
| Source | [`algorithms/random/icg.js`](../../../algorithms/random/icg.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 1 byte (8 bits) to 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Eichenauer-Herrmann: Inversive Congruential Pseudorandom Numbers (1992)](https://doi.org/10.1145/146382.146385)
- [Wikipedia: Inversive Congruential Generator](https://en.wikipedia.org/wiki/Inversive_congruential_generator)
- [Knuth: The Art of Computer Programming Vol. 2 (Section 3.2.2)](https://www-cs-faculty.stanford.edu/~knuth/taocp.html)

## References

- [Eichenauer, J., Lehn, J.: A non-linear congruential pseudo random number generator](https://link.springer.com/article/10.1007/BF02307276)
- [Niederreiter, H.: Random Number Generation and Quasi-Monte Carlo Methods](https://doi.org/10.1137/1.9781611970081)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ICG with C# default parameters - seed=1, first 5 values](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000001` |
| `multiplier` | `5851f42d4c957f2d` |
| `increment` | `14057b7ef767814f` |
| `modulo` | `ffffffffffffffc5` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `6c576fac43fd007c26aa6283eb34dd79 b7bd4dc5927e304704b92c926378a484 e97a4a5839b3a1d9` |

**Vector 2** — [ICG with seed=0 (special case - returns increment)](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `multiplier` | `5851f42d4c957f2d` |
| `increment` | `14057b7ef767814f` |
| `modulo` | `ffffffffffffffc5` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `14057b7ef767814f` |

**Vector 3** — [ICG with small modulus m=251 (prime), a=3, c=5, seed=7](https://en.wikipedia.org/wiki/Inversive_congruential_generator)

| Field | Value |
| --- | --- |
| `seed` | `07` |
| `multiplier` | `03` |
| `increment` | `05` |
| `modulo` | `fb` |
| `outputSize` | `10` |
| `input` | `null` |
| `expected` | `71415aa4e6dc0db378bb` |

---

[← All algorithms](../README.md)
