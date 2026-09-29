# Combined LCG

> Combined Linear Congruential Generator combines outputs from multiple LCG instances to produce better statistical properties than a single LCG. Developed by Pierre L'Ecuyer in 1988, the combination methods (additive, subtractive, multiplicative, XOR) significantly extend the period and improve randomness quality.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Pseudorandom Number Generator |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Pierre L'Ecuyer |
| Year | 1988 |
| Origin | 🇨🇦 Canada |
| Source | [`algorithms/random/combined-lcg.js`](../../../algorithms/random/combined-lcg.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 1 byte (8 bits) to 32 bytes (256 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [L'Ecuyer, P. (1988): Efficient and Portable Combined Random Number Generators (CACM 31(6):742-749,774)](https://www.iro.umontreal.ca/~lecuyer/myftp/papers/cacm88.pdf)
- [L'Ecuyer, P. (1999): Good Parameters for Combined Multiple Recursive Generators (Operations Research 47(1):159-164)](https://pubsonline.informs.org/doi/pdf/10.1287/opre.47.1.159)
- [Wikipedia: Linear Congruential Generator](https://en.wikipedia.org/wiki/Linear_congruential_generator)

## References

- [L'Ecuyer's RNG Papers and Software](https://www.iro.umontreal.ca/~lecuyer/papers.html)
- [Knuth, D. E.: The Art of Computer Programming, Vol. 2 (Seminumerical Algorithms)](https://www-cs-faculty.stanford.edu/~knuth/taocp.html)
- [TestU01: Statistical Testing Suite for RNGs](http://simul.iro.umontreal.ca/testu01/tu01.html)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Default PCG parameters, Additive mode, seed=1 - First 5 values](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000001` |
| `combinationMode` | `0` |
| `lcg1Multiplier` | `5851f42d4c957f2d` |
| `lcg1Increment` | `14057b7ef767814f` |
| `lcg1Modulo` | `00` |
| `lcg2Multiplier` | `369dea0f31a53f85` |
| `lcg2Increment` | `255992d382208b61` |
| `lcg2Modulo` | `00` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `618049f4081c4420659a51615ac96cb0 c55ee230c7bb90d8d13ac8e8fa053618 925b372afca62170` |

**Vector 2** — [Default PCG parameters, XOR mode, seed=42 - First 5 values](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `000000000000002a` |
| `combinationMode` | `3` |
| `lcg1Multiplier` | `5851f42d4c957f2d` |
| `lcg1Increment` | `14057b7ef767814f` |
| `lcg1Modulo` | `00` |
| `lcg2Multiplier` | `369dea0f31a53f85` |
| `lcg2Increment` | `255992d382208b61` |
| `lcg2Modulo` | `00` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `079c9839b884a2704981dc493c664dde 2ed1bfec97391484183722416c6399f6 3ed118fd21a09238` |

**Vector 3** — [L'Ecuyer 1988 32-bit parameters, Additive mode, seed=12345 - First 5 values](https://www.iro.umontreal.ca/~lecuyer/myftp/papers/cacm88.pdf)

| Field | Value |
| --- | --- |
| `seed` | `0000000000003039` |
| `combinationMode` | `0` |
| `lcg1Multiplier` | `00009c4e` |
| `lcg1Increment` | `00000000` |
| `lcg1Modulo` | `7fffffab` |
| `lcg2Multiplier` | `00009ef4` |
| `lcg2Increment` | `00000000` |
| `lcg2Modulo` | `7fffff07` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `000000006265368c000000005fa82458 0000000039fd3bd5000000005bf0874e 0000000075a84d5d` |

**Vector 4** — [Subtractive mode test, seed=1 - First 5 values](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000001` |
| `combinationMode` | `1` |
| `lcg1Multiplier` | `5851f42d4c957f2d` |
| `lcg1Increment` | `14057b7ef767814f` |
| `lcg1Modulo` | `00` |
| `lcg2Multiplier` | `369dea0f31a53f85` |
| `lcg2Increment` | `255992d382208b61` |
| `lcg2Modulo` | `00` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `d226e9cefa38d85898c47e2167f31f06 7017c59a44754ac45cf94be0781ecaf2 97c52ce171d305f0` |

**Vector 5** — [Multiplicative mode test, seed=100 - First 5 values](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000064` |
| `combinationMode` | `2` |
| `lcg1Multiplier` | `5851f42d4c957f2d` |
| `lcg1Increment` | `14057b7ef767814f` |
| `lcg1Modulo` | `00` |
| `lcg2Multiplier` | `369dea0f31a53f85` |
| `lcg2Increment` | `255992d382208b61` |
| `lcg2Modulo` | `00` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `240f6b8a133e41bff80401a36365d6dc 879fb6afb278c5d7d2ec230014f07200 c6c06de607e40507` |

---

[← All algorithms](../README.md)
