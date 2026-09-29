# Multiply-with-Carry (MWC)

> Multiply-with-Carry is a fast, simple PRNG invented by George Marsaglia. It uses multiply and carry operations to generate high-quality pseudo-random numbers with very long periods. The algorithm maintains a state value and carry, updating them through multiplication and modular arithmetic.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Deterministic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | George Marsaglia |
| Year | 1991 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/mwc.js`](../../../algorithms/random/mwc.js) |

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

- [Original Paper: A new class of random number generators (1991)](https://projecteuclid.org/journals/annals-of-applied-probability/volume-1/issue-3/A-New-Class-of-Random-Number-Generators/10.1214/aoap/1177005878.full)
- [Efficient MWC Random Number Generators with Maximal Period](https://www.math.ias.edu/~goresky/MWC.pdf)
- [Wikipedia: Multiply-with-carry pseudorandom number generator](https://en.wikipedia.org/wiki/Multiply-with-carry_pseudorandom_number_generator)
- [Java Implementation Example](https://www.javamex.com/tutorials/random_numbers/multiply_with_carry.shtml)

## References

- [Numerical Recipes (3rd ed., p. 348)](http://numerical.recipes/)
- [Distribution Properties of MWC Generators](https://www.researchgate.net/publication/220576338_Distribution_properties_of_multiply-with-carry_random_number_generators)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed 1: First 5 outputs (40 bytes) - multiplier 0xffffda61](https://www.javamex.com/tutorials/random_numbers/multiply_with_carry.shtml)

| Field | Value |
| --- | --- |
| `seed` | `0100000000000000` |
| `outputSize` | `40` |
| `multiplier` | `4294957665` |
| `input` | `null` |
| `expected` | `5fdaffff0000000000a48705c0b4ffff 00240df6ef9f96102133a247671f62e3 ff167521a1c426df` |

**Vector 2** — [Seed 12345: First 5 outputs - standard test seed](https://www.javamex.com/tutorials/random_numbers/multiply_with_carry.shtml)

| Field | Value |
| --- | --- |
| `seed` | `3930000000000000` |
| `outputSize` | `40` |
| `multiplier` | `4294957665` |
| `input` | `null` |
| `expected` | `5f9fe9f8383000000049dda20270d3f1 37d902ddd2555ae14f70a9434f1180d7 a208e25d4d3b9ee8` |

**Vector 3** — Seed 0xDEADBEEF: First 5 outputs - hex seed value

Source: Self-generated test vector for verification

| Field | Value |
| --- | --- |
| `seed` | `efbeadde00000000` |
| `outputSize` | `40` |
| `multiplier` | `4294957665` |
| `input` | `null` |
| `expected` | `9f1fd0b6349eadde40612a60753e1d51 bad64c04749ff9c403f35a8a0c093799 a3245db13a84dd6c` |

**Vector 4** — Seed 999999999: First 8 outputs - large seed

Source: Self-generated test vector for verification

| Field | Value |
| --- | --- |
| `seed` | `ffc99a3b00000000` |
| `outputSize` | `64` |
| `multiplier` | `4294957665` |
| `input` | `null` |
| `expected` | `9fe50f603cc19a3b4067f0093d2704fd b8575e50e735b04ac6eebd6f706e2275 f33f3670ca1665b54c8632ecffd5212a ed969ab4359f40dd9ad14da677f174f2` |

---

[← All algorithms](../README.md)
