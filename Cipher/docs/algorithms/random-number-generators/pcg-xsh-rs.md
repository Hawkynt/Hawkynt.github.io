# PCG-XSH-RS

> PCG variant using 64-bit state with XSH-RS permutation (XOR-shift-high with random shift) to output 32-bit values. Requires 49 bits of state to pass BigCrush tests. This variant trades slightly lower statistical quality for simpler implementation compared to XSH-RR.

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
| Source | [`algorithms/random/pcg-xsh-rs.js`](../../../algorithms/random/pcg-xsh-rs.js) |

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
- [Rust PCG Implementation](https://github.com/rust-random/rand/blob/master/rand_pcg/src/pcg64.rs)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [PCG-XSH-RS seed=42, increment=54, first 6 x 32-bit outputs](https://www.pcg-random.org/)

| Field | Value |
| --- | --- |
| `seed` | `000000000000002a` |
| `increment` | `0000000000000036` |
| `outputSize` | `24` |
| `input` | `null` |
| `expected` | `522bd5a371b43492b011fa35e704af294a1aaabfaf9bfaaa` |

**Vector 2** — [PCG-XSH-RS seed=0, increment=1, first 6 x 32-bit outputs](https://www.pcg-random.org/)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `increment` | `0000000000000001` |
| `outputSize` | `24` |
| `input` | `null` |
| `expected` | `0b18fcd8bb5f56897033235de0b78bd0faba6f9ea2df44bd` |

---

[← All algorithms](../README.md)
