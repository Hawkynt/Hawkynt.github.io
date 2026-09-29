# PCG-RXS-M-XS

> PCG variant using RXS-M-XS permutation (Random XorShift, Multiply, XorShift) - the most statistically powerful PCG output function. This 64-bit state generator passes BigCrush with excellent uniformity, combining variable xorshift based on state bits, MCG multiplication, and final xorshift for superior statistical properties.

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
| Source | [`algorithms/random/pcg-rxs-m-xs.js`](../../../algorithms/random/pcg-rxs-m-xs.js) |

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
- [Apache Commons RNG: PcgRxsMXs64](https://github.com/apache/commons-rng/blob/master/commons-rng-core/src/main/java/org/apache/commons/rng/core/source64/PcgRxsMXs64.java)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [PCG-RXS-M-XS seed=0x012de1babb3c4104, first 10 x 64-bit outputs (Apache Commons RNG)](https://github.com/apache/commons-rng/blob/master/commons-rng-core/src/test/java/org/apache/commons/rng/core/source64/PcgRxsMXs64Test.java)

| Field | Value |
| --- | --- |
| `seed` | `012de1babb3c4104` |
| `outputSize` | `80` |
| `input` | `null` |
| `expected` | `a5ace6c92c5fa6c7ac02118387228764 a6e796e49dc36e004713f32552134368 a2ad36cb4e6b7cc96bbce7db898fa11d 134cb18300fe9eb03f705c0d635cbc23 4bd7531b62a59b62413cc95f3c3e9952` |

**Vector 2** — [PCG-RXS-M-XS seed=0x012de1babb3c4104 + increment=0xc8161b4202294965, first 10 x 64-bit outputs (Apache Commons RNG)](https://github.com/apache/commons-rng/blob/master/commons-rng-core/src/test/java/org/apache/commons/rng/core/source64/PcgRxsMXs64Test.java)

| Field | Value |
| --- | --- |
| `seed` | `012de1babb3c4104` |
| `sequence` | `c8161b4202294965` |
| `outputSize` | `80` |
| `input` | `null` |
| `expected` | `c147f2291fa40ccf8edbcbf8a5f49877 61e05a1d5213f0b4c039f9369032e638 95146e605b2e4a965480af6332262d03 7cbfb3a67a7145575c9f0a25eba41575 6e23dba403318dec7b230e581b829dbc` |

---

[← All algorithms](../README.md)
