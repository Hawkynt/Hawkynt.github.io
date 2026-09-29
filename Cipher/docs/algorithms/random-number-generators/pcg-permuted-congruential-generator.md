# PCG (Permuted Congruential Generator)

> PCG is a family of simple, fast, space-efficient, statistically excellent pseudorandom number generators developed by Melissa O'Neill. This implementation uses 128-bit state with RXS-M-XS permutation outputting 64-bit values, combining a linear congruential generator with output mixing for excellent statistical properties.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Pseudorandom Number Generator |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Melissa E. O'Neill |
| Year | 2014 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/pcg.js`](../../../algorithms/random/pcg.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 8 bytes (64 bits) to 16 bytes (128 bits) in steps of 8 bytes |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Official PCG Website](https://www.pcg-random.org/)
- [Original Paper: PCG: A Family of Simple Fast Space-Efficient Statistically Good Algorithms for Random Number Generation](https://www.pcg-random.org/pdf/toms-oneill-pcg-family-v1.02.pdf)
- [Wikipedia: Permuted Congruential Generator](https://en.wikipedia.org/wiki/Permuted_congruential_generator)

## References

- [PCG C Implementation (Official)](https://github.com/imneme/pcg-c)
- [PCG C++ Implementation (Official)](https://github.com/imneme/pcg-cpp)
- [Rosetta Code: PCG32](https://rosettacode.org/wiki/Pseudo-random_numbers/PCG32)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [PCG64 seed=0, first 9 x 64-bit outputs (Abseil golden vector)](https://github.com/abseil/abseil-cpp/blob/master/absl/random/internal/pcg_engine_test.cc#L275-L320)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `72` |
| `input` | `null` |
| `expected` | `01070196e695f8f1703ec840c59f4493 e54954914b3a44fa96130ff204b9285e 7d9fdef535ceb21a666feed42e1219a0 981f685721c8326fad80710d6eab4dda e202c480b037a029` |

---

[← All algorithms](../README.md)
