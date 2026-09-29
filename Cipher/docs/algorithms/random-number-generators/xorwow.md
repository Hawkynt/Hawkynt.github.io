# XorWow

> XorWow combines George Marsaglia's XorShift algorithm with a Weyl sequence for improved statistical properties. It has a period of 2^192-2^32 and is used as the default PRNG in NVIDIA's CUDA cuRAND library for GPU-accelerated random number generation.

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
| Source | [`algorithms/random/xorwow.js`](../../../algorithms/random/xorwow.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 1 byte (8 bits) to 24 bytes (192 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [NVIDIA CUDA cuRAND Documentation](https://docs.nvidia.com/cuda/curand/device-api-overview.html#xorwow-generator)
- [Original Paper: Xorshift RNGs (Marsaglia, 2003)](https://www.jstatsoft.org/article/view/v008i14)
- [Wikipedia: Xorshift](https://en.wikipedia.org/wiki/Xorshift)
- [TestU01 Results for XorWow](https://github.com/cmcqueen/simplerandom)

## References

- [CUDA Toolkit Source Code](https://developer.nvidia.com/cuda-toolkit)
- [SimpleRandom Library (Reference Implementation)](https://github.com/cmcqueen/simplerandom)
- [Random123 Library (Alternative High-Quality PRNGs)](https://www.deshawresearch.com/resources_random123.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed (1): First 5 outputs - verified against C# implementation](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000001` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `acbed487b97556a081f6278d17aec601c87f3b27` |

**Vector 2** — [Seed (123456789): First 5 outputs - verified against C# implementation](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `00000000075bcd15` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `f43c1487a09d56a0450e278d8d50c6016e23fb27` |

**Vector 3** — [Seed (0xDEADBEEF): First 5 outputs - common test value](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `00000000deadbeef` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `3416e0475731bd202a80e40d8042ec81fa2c61e7` |

**Vector 4** — [Seed (1000000): First 5 outputs - large seed value](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `00000000000f4240` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `780c3c87e80af6a073acc78df627660119333327` |

---

[← All algorithms](../README.md)
