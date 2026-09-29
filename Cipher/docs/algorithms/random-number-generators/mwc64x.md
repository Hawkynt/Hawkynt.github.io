# MWC64X

> MWC64X is a GPU-optimized 64-bit Multiply-With-Carry generator designed for OpenCL/CUDA with period ~2^63. It uses minimal state (64 bits) and very fast operations (5-6 instructions) while passing rigorous statistical tests. Ideal for massively parallel simulations.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Multiply-With-Carry PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | David B. Thomas |
| Year | 2011 |
| Origin | 🇬🇧 United Kingdom |
| Source | [`algorithms/random/mwc64x.js`](../../../algorithms/random/mwc64x.js) |

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

- [Official MWC64X Page (David B. Thomas, Imperial College)](http://cas.ee.ic.ac.uk/people/dt10/research/rngs-gpu-mwc64x.html)
- [Original MWC Paper: Marsaglia&Zaman (1991)](https://projecteuclid.org/journals/annals-of-applied-probability/volume-1/issue-3/A-New-Class-of-Random-Number-Generators/10.1214/aoap/1177005878.full)
- [OpenCL Implementation Example (GitHub)](https://github.com/profmaad/opencl-option-pricer/blob/master/kernels/mwc64x/)
- [SYCL-PRNG Library (MWC64X implementation)](https://github.com/Wigner-GPU-Lab/SYCL-PRNG)

## References

- [GPU Random Number Generation Review](https://arxiv.org/abs/1204.6193)
- [Wikipedia: Multiply-with-carry pseudorandom number generator](https://en.wikipedia.org/wiki/Multiply-with-carry_pseudorandom_number_generator)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed 1: First 10 outputs (40 bytes) - x=1, c=0](http://cas.ee.ic.ac.uk/people/dt10/research/rngs-gpu-mwc64x.html)

| Field | Value |
| --- | --- |
| `seed` | `0100000000000000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `010000001bb8feffeea2075ccba5b14e a56f21525d2fe55ccf64d299cf405917 8eeb1d4329577ced` |

**Vector 2** — [Seed 123456: First 10 outputs - decimal seed value](http://cas.ee.ic.ac.uk/people/dt10/research/rngs-gpu-mwc64x.html)

| Field | Value |
| --- | --- |
| `seed` | `40e2010000000000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `40e20100fd3e51964536e3a981b77780 05d90d3d686fc6b70e0ebd5f07623ccd 8a3874e58088b9ce` |

**Vector 3** — [Seed 0xDEADBEEF: First 10 outputs - hex seed value](http://cas.ee.ic.ac.uk/people/dt10/research/rngs-gpu-mwc64x.html)

| Field | Value |
| --- | --- |
| `seed` | `efbeadde00000000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `efbeadde824a1c01fc44561708baa593 2e54e3aefa448724cd006f090be01aca effedc7a03a5c5eb` |

**Vector 4** — [Seed x=1, c=1: First 10 outputs - non-zero carry](http://cas.ee.ic.ac.uk/people/dt10/research/rngs-gpu-mwc64x.html)

| Field | Value |
| --- | --- |
| `seed` | `0100000001000000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `000000001cb8feffccfa045c1acfbe32 4b02f33dbdc64f0e57d817ff7a3489ba ff68477c9903a06a` |

**Vector 5** — [Seed 999999: First 8 outputs - medium seed value](http://cas.ee.ic.ac.uk/people/dt10/research/rngs-gpu-mwc64x.html)

| Field | Value |
| --- | --- |
| `seed` | `3f420f0000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `3f420f008e06b474b3b8662b4d8765cd94d31ed4dd1d373cb2d2ee2130b81cdb` |

---

[← All algorithms](../README.md)
