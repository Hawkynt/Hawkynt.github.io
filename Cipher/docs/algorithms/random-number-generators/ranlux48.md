# RANLUX48

> C++ standard library's highest-quality luxury PRNG using 48-bit subtract-with-borrow with luxury level 4. Designed for Monte Carlo simulations requiring provably decorrelated sequences with superior statistical quality.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Pseudo-Random Number Generator |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Martin Lüscher |
| Year | 1994 |
| Origin | 🇨🇭 Switzerland |
| Source | [`algorithms/random/ranlux48.js`](../../../algorithms/random/ranlux48.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 4 bytes (32 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Original Paper: M. Lüscher (Computer Physics Communications 1994)](https://www.sciencedirect.com/science/article/abs/pii/001046559490232X)
- [C++ Reference: std::ranlux48](https://en.cppreference.com/w/cpp/numeric/random/discard_block_engine)
- [C++ Reference: std::subtract_with_carry_engine](https://en.cppreference.com/w/cpp/numeric/random/subtract_with_carry_engine)
- [Martin Lüscher's RANLUX Page](https://luscher.web.cern.ch/luscher/ranlux/)

## References

- [OEIS A221562: ranlux48 Sequence](https://oeis.org/A221562)
- [OEIS A221560: ranlux48_base Sequence](https://oeis.org/A221560)
- [LLVM libc++ Test Vector](https://github.com/google/libcxx/blob/master/test/numerics/rand/rand.predef/ranlux48.pass.cpp)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RANLUX48 with default seed 19780503, first 5 outputs (OEIS A221562)](https://oeis.org/A221562)

| Field | Value |
| --- | --- |
| `seed` | `97d32d01` |
| `outputSize` | `30` |
| `input` | `null` |
| `expected` | `2c7be5fc5515dff2d90c0c1afa090149cafb070b4b391e77bce7833bb94c` |

**Vector 2** — [RANLUX48 default seed, outputs 6-10 (OEIS A221562)](https://oeis.org/A221562)

| Field | Value |
| --- | --- |
| `seed` | `97d32d01` |
| `skipBytes` | `30` |
| `outputSize` | `30` |
| `input` | `null` |
| `expected` | `e1c334e74fbd22d580d867419b9834038fdc244b4dd2dfe9271d96c95532` |

**Vector 3** — [RANLUX48 default seed, 10000th value (LLVM libc++ test)](https://github.com/google/libcxx/blob/master/test/numerics/rand/rand.predef/ranlux48.pass.cpp)

| Field | Value |
| --- | --- |
| `seed` | `97d32d01` |
| `skipBytes` | `59994` |
| `outputSize` | `6` |
| `input` | `null` |
| `expected` | `35ca5b0c98e2` |

**Vector 4** — [RANLUX48 default seed, values 11-12 (OEIS A221562)](https://oeis.org/A221562)

| Field | Value |
| --- | --- |
| `seed` | `97d32d01` |
| `skipBytes` | `60` |
| `outputSize` | `12` |
| `input` | `null` |
| `expected` | `f533f47cfcfeecc7ec43f0f4` |

---

[← All algorithms](../README.md)
