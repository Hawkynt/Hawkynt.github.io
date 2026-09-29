# CMWC (Complementary Multiply-with-Carry)

> CMWC is an advanced pseudo-random number generator invented by George Marsaglia. It uses a large state array (4096 values) with multiply-and-carry operations, achieving an extraordinary period of 2^131104. The complementary aspect returns the bitwise complement of computed values, improving randomness quality.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Deterministic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | George Marsaglia |
| Year | 2003 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/cmwc.js`](../../../algorithms/random/cmwc.js) |

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

- [Original Paper: Random Number Generators (Journal of Modern Applied Statistical Methods, 2003)](https://digitalcommons.wayne.edu/jmasm/vol2/iss1/2/)
- [Wikipedia: Multiply-with-carry pseudorandom number generator](https://en.wikipedia.org/wiki/Multiply-with-carry_pseudorandom_number_generator)
- [Marsaglia's Post on CMWC4096 (sci.crypt, 2003)](https://groups.google.com/g/sci.crypt/c/yoaCpGWKEk0)
- [Logical Intuitions: PRNG 3: Complementary Multiply-with-Carry](https://blacklen.wordpress.com/2011/05/15/prng-3-complementary-multiply-with-carry/)

## References

- [TestU01 Statistical Testing Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)
- [DieHarder Random Number Test Suite](https://webhome.phy.duke.edu/~rgb/General/dieharder.php)
- [Uncommons Maths CMWC4096RNG Java Implementation](https://maths.uncommons.org/api/org/uncommons/maths/random/CMWC4096RNG.html)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Seed 0: First 5 outputs (40 bytes) - verified against C# reference

Source: X:\Coding\Working Copies\Hawkynt.git\Randomizer\RandomNumberGenerators\Deterministic\ComplementaryMultiplyWithCarry.cs

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `8b912eacca47b64c238592b521f4679e 5aa031f54b2dde8ceaa62edfe6338250 f333513179fbd3ec` |

**Vector 2** — Seed 1: First 5 outputs (40 bytes)

Source: X:\Coding\Working Copies\Hawkynt.git\Randomizer\RandomNumberGenerators\Deterministic\ComplementaryMultiplyWithCarry.cs

| Field | Value |
| --- | --- |
| `seed` | `0000000000000001` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `c108910a0e5eb78a710077017762a450 17f2258dea636a1960cde049597dfdfe 76dfd35b7206acfd` |

**Vector 3** — Seed 42: First 5 outputs (40 bytes)

Source: X:\Coding\Working Copies\Hawkynt.git\Randomizer\RandomNumberGenerators\Deterministic\ComplementaryMultiplyWithCarry.cs

| Field | Value |
| --- | --- |
| `seed` | `000000000000002a` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `8211488f4151822e08142692d53eebf4 3ed2ac69afb32196b7937d066ece679c f68f0e03de311c72` |

**Vector 4** — Seed 1234567: First 8 outputs (64 bytes)

Source: X:\Coding\Working Copies\Hawkynt.git\Randomizer\RandomNumberGenerators\Deterministic\ComplementaryMultiplyWithCarry.cs

| Field | Value |
| --- | --- |
| `seed` | `000000000012d687` |
| `outputSize` | `64` |
| `input` | `null` |
| `expected` | `3e8eecf519743031bedf18e3222799cd eb8f9b725b43854f8a91e2002dedf10b 9eae5ee7c03cad416a6574def1b8840f e939516b2f6a4f743d4da6c4c5b8eb73` |

**Vector 5** — Seed 987654321: First 8 outputs (64 bytes)

Source: X:\Coding\Working Copies\Hawkynt.git\Randomizer\RandomNumberGenerators\Deterministic\ComplementaryMultiplyWithCarry.cs

| Field | Value |
| --- | --- |
| `seed` | `000000003ade68b1` |
| `outputSize` | `64` |
| `input` | `null` |
| `expected` | `1ac7b2559be4d603ea2c816307a5144a a700d67e836ecb7604e9a7352e91d212 05c4820e5877a6d359613d5949c1e7de 07b44a075e6ceb68c305ea20312d2bca` |

---

[← All algorithms](../README.md)
