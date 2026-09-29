# Lehmer64

> Lehmer64 is a 64-bit multiplicative congruential generator (MCG) that uses 128-bit arithmetic internally for high-quality output. Based on Lehmer's original MCG (1951) but optimized for modern 64-bit systems by Daniel Lemire (2019). It's extremely fast and passes BigCrush statistical tests.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Multiplicative Congruential Generator |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | D. H. Lehmer (original), Daniel Lemire (64-bit variant) |
| Year | 1951 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/lehmer64.js`](../../../algorithms/random/lehmer64.js) |

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

- [D. H. Lehmer: Mathematical methods in large-scale computing units (1951)](https://doi.org/10.2307/2002781)
- [Daniel Lemire: The fastest conventional random number generator that can pass Big Crush?](https://lemire.me/blog/2019/03/19/the-fastest-conventional-random-number-generator-that-can-pass-big-crush/)
- [Reference Implementation (C)](https://github.com/lemire/testingRNG/blob/master/source/lehmer64.h)
- [P. L'Ecuyer: Tables of linear congruential generators (1999)](https://doi.org/10.1090/S0025-5718-99-00996-5)

## References

- [PCG Random: Does it beat the minimal standard?](https://www.pcg-random.org/posts/does-it-beat-the-minimal-standard.html)
- [TestU01: BigCrush Statistical Testing Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed 1 (SplitMix64 initialization): First 5 outputs](https://github.com/lemire/testingRNG/blob/master/source/lehmer64.h)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000001` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `d013072351f5fc50f5116e796b986d61 cfe0853995d9c9838af139b0bd173856 f4ba5b360862da7f` |

**Vector 2** — [Seed 0 (SplitMix64 initialization): First 5 outputs](https://github.com/lemire/testingRNG/blob/master/source/lehmer64.h)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `c112a6a15fadb6f6ec0339a6f15317e2 84824b46bbd0a6f9e2f53aaa2457752d 85de4d73c42a63b9` |

**Vector 3** — [Seed 42 (SplitMix64 initialization): First 5 outputs](https://github.com/lemire/testingRNG/blob/master/source/lehmer64.h)

| Field | Value |
| --- | --- |
| `seed` | `000000000000002a` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `ceae6504d53ce75febbe9b2aeb6593fc 1349d62b159350f9a92566124ec338fb bc24bd3b1be4839f` |

**Vector 4** — [Direct state 0x123456789ABCDEF0123456789ABCDEF0: First 3 outputs](https://github.com/lemire/testingRNG/blob/master/source/lehmer64.h)

| Field | Value |
| --- | --- |
| `state` | `123456789abcdef0123456789abcdef0` |
| `outputSize` | `24` |
| `input` | `null` |
| `expected` | `bf82f820876e23a96664d56f05045b883cf48e8a467812b9` |

---

[← All algorithms](../README.md)
