# Wyrand

> Wyrand is an extremely fast 64-bit pseudo-random number generator based on the WyHash mixing function. Designed by Wang Yi, it passes TestU01 BigCrush and is used in Go's standard library fastrand. Provides excellent statistical quality with minimal state and exceptional performance.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Hash-Based PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Wang Yi |
| Year | 2020 |
| Origin | 🇨🇳 China |
| Source | [`algorithms/random/wyrand.js`](../../../algorithms/random/wyrand.js) |

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

- [WyHash Official Repository](https://github.com/wangyi-fudan/wyhash)
- [Modern Non-Cryptographic Hash Function and PRNG (Paper)](https://github.com/wangyi-fudan/wyhash/blob/master/Modern%20Non-Cryptographic%20Hash%20Function%20and%20Pseudorandom%20Number%20Generator.pdf)
- [Go Runtime Implementation (fastrand)](https://go.dev/src/runtime/hash64.go)
- [TestU01 Statistical Testing Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)

## References

- [Lemire's Testing RNG - Wyrand Implementation](https://github.com/lemire/testingRNG/blob/master/source/wyrand.h)
- [Wyrand Rust Implementation](https://github.com/Bluefinger/wyrand-rs)
- [WyHash .NET Implementation](https://github.com/cocowalla/wyhash-dotnet)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed 0: First 8 outputs (verified against reference C implementation)](https://github.com/wangyi-fudan/wyhash)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `64` |
| `input` | `null` |
| `expected` | `111cb3a78f59a58eceabd938ff4e856d 61fb51318f47d2a478bd03c491909760 7c003d7fb14820de8769964729356b1f e214284dc87f982929a283ebb1b295a2` |

**Vector 2** — [Seed 1: First 5 outputs](https://github.com/wangyi-fudan/wyhash)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000001` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `cdef1695e1f8ed2c61d6d24b1c9aad40 8cf880c22eebfadf05b3a992fedc4f8a 01942e5b0cb4ae64` |

**Vector 3** — [Seed 42: First 5 outputs (commonly used test seed)](https://github.com/wangyi-fudan/wyhash)

| Field | Value |
| --- | --- |
| `seed` | `000000000000002a` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `ae4a7cbfdda9b434e9cc09d33d38d9d2 cb5756512b93433aeb29b2a1320e1a71 5a3bd6480ed396c0` |

**Vector 4** — [Seed 1234567: First 5 outputs](https://github.com/wangyi-fudan/wyhash)

| Field | Value |
| --- | --- |
| `seed` | `000000000012d687` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `0e6c0d75670e37cc6c97c0b827352c64 d0cd28cec7470d39a51d2a195ac69861 e09117771f95f935` |

**Vector 5** — [Seed 0x123456789ABCDEF: First 5 outputs](https://github.com/wangyi-fudan/wyhash)

| Field | Value |
| --- | --- |
| `seed` | `0123456789abcdef` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `58b962217aafc627d7488e0f880dbd37 a175b746466eac63159c6469d42795c0 cc2ec3081b141be7` |

---

[← All algorithms](../README.md)
