# XorShift+

> XorShift+ is a fast pseudo-random number generator using XOR-shift operations with addition scrambling. Uses parameters (23, 17, 26) and complementary seed initialization for improved coverage of the state space.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Deterministic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | George Marsaglia / Sebastiano Vigna |
| Year | 2003 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/xorshift-plus.js`](../../../algorithms/random/xorshift-plus.js) |

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

- [Wikipedia: Xorshift](https://en.wikipedia.org/wiki/Xorshift)
- [Original Xorshift Paper (Marsaglia, 2003)](https://www.jstatsoft.org/article/view/v008i14)
- [Vigna's Analysis of Xorshift Generators](https://vigna.di.unimi.it/ftp/papers/xorshift.pdf)

## References

- [TestU01 Statistical Testing Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)
- [Modern PRNG Alternatives (xoshiro/xoroshiro)](https://prng.di.unimi.it/)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed(1): First 5 outputs - verified against ported C# implementation](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `0100000000000000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `3e008000c0ffffff01100000c0ffffff ffef9ffeff4f00e0beff0fff3fc000c0 ce1fe4ff373000e0` |

**Vector 2** — [Seed(2): First 5 outputs](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `0200000000000000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `7d000001c0ffffff42108000c0ffffff ffdf1ffeff8f00e07dff5ffe3f4001c0 cd2fb8ff2f3000e0` |

**Vector 3** — [Seed(123456789): First 10 outputs](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `15cd5b0700000000` |
| `outputSize` | `80` |
| `input` | `null` |
| `expected` | `d67917552752fcffef01a4542752fcff 2bd2ae106de2ad13dd22e59137e85b27 f133926903d03d4a82a4449b6cd1acf6 cb6bbf5808d507ab69126f885c380d9e e9fdb04d5ee0c0661eb3a02d6279eff6` |

**Vector 4** — [Seed(1000000): First 5 outputs - large seed value](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `40420f0000000000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `c64dc12361f8ffffcf355f2361f8ffff e0ffc3275e889130b5bfc4335d392361 faf73ecec1dea55f` |

**Vector 5** — [Seed(0xFFFFFFFFFFFFFFFF): First 5 outputs - maximum seed](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `ffffffffffffffff` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `c2ff7f000000000041ff7f0100000000 beefff00004000007c00f00000800000 bd200c01f83f0000` |

---

[← All algorithms](../README.md)
