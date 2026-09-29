# PCG-XSL-RR-64-32

> PCG variant using 64-bit state with XSH-RR permutation (XOR-shift-high with random rotation) to output 32-bit values. This is the standard PCG32 algorithm, combining a simple LCG with sophisticated output mixing for excellent statistical properties in a compact implementation.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Permuted Congruential Generator |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Melissa E. O'Neill |
| Year | 2014 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/pcg-xsl-rr.js`](../../../algorithms/random/pcg-xsl-rr.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 8 bytes (64 bits) |

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
- [Abseil PCG Engine Implementation](https://github.com/abseil/abseil-cpp/blob/master/absl/random/internal/pcg_engine.h)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [PCG32 (XSH-RR-64-32) seed=0, first 21 x 32-bit outputs (Abseil golden vector)](https://github.com/abseil/abseil-cpp/blob/master/absl/random/internal/pcg_engine_test.cc#L487-L534)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `84` |
| `input` | `null` |
| `expected` | `7a7ecbd989fd6c06ae646aa8cd3cf945 6204b303198c858549fce611d1e9297a 142d9440ee75f56b473a9117e3a45903 bce807a1e54e5f4d497d6c5161829166 a740474b031912a89de3defad266dbf1 0f38bebb` |

---

[← All algorithms](../README.md)
