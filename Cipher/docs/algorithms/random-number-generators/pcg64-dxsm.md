# PCG64-DXSM

> PCG variant using 128-bit state with DXSM (Double Xorshift Multiply) output permutation to produce 64-bit values. This is NumPy's default random number generator, using a cheap 64-bit multiplier for improved performance while maintaining excellent statistical properties.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Permuted Congruential Generator |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Melissa E. O'Neill |
| Year | 2019 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/pcg64-dxsm.js`](../../../algorithms/random/pcg64-dxsm.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 16 bytes (128 bits) |

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
- [NumPy PCG64DXSM Documentation](https://numpy.org/doc/stable/reference/random/bit_generators/pcg64dxsm.html)
- [Original Paper: PCG: A Family of Simple Fast Space-Efficient Statistically Good Algorithms for Random Number Generation](https://www.pcg-random.org/pdf/toms-oneill-pcg-family-v1.02.pdf)
- [Wikipedia: Permuted Congruential Generator](https://en.wikipedia.org/wiki/Permuted_congruential_generator)

## References

- [NumPy PCG64DXSM Implementation](https://github.com/numpy/numpy/pull/18906)
- [PCG C Implementation (Official)](https://github.com/imneme/pcg-c)
- [PCG C++ Implementation (Official)](https://github.com/imneme/pcg-cpp)
- [Tony Finch's PCG-DXSM Implementation](https://github.com/fanf2/pcg-dxsm)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [PCG64-DXSM state=0, inc=1: first 10 x 64-bit outputs (NumPy verified)](https://numpy.org/doc/stable/reference/random/bit_generators/pcg64dxsm.html)

| Field | Value |
| --- | --- |
| `seed` | `00000000000000010000000000000000` |
| `outputSize` | `80` |
| `input` | `null` |
| `expected` | `00000000000000000000000000000000 00000000000000005238ea76d1f0df4a 1a3c4747022e48a4340b0228e6afc056 81bb52f8baaa203a0fd17a4a4b0a1ce3 55fe9ec2c245a242a2f6d5a82a0704f9` |

---

[← All algorithms](../README.md)
