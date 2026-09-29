# XorShift*

> XorShift* is a fast pseudo-random number generator using XOR-shift operations with multiplicative scrambling. Uses parameters (12, 25, 27) and multiplier 0x2545F4914F6CDD1D for excellent output quality across all bits.

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
| Source | [`algorithms/random/xorshift-star.js`](../../../algorithms/random/xorshift-star.js) |

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

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed(1): First 5 outputs - verified against ported C# implementation](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `0100000000000000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `1ddd6c894bcee4471d6579e0a8a6cfab 571f73eb8f0dd1b99d011bbba018b44d 00a65a4db099610e` |

**Vector 2** — [Seed(2): First 5 outputs](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `0200000000000000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `3abad912979cc98f3acaf2c0514d9f57 cb1b53ecf63549765798dd31dceda994 57e3db90c4465d0e` |

**Vector 3** — [Seed(123456789): First 10 outputs](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `15cd5b0700000000` |
| `outputSize` | `80` |
| `input` | `null` |
| `expected` | `d7e3f5835ac3c0ed4b1c8d2dfaf4927e 74ff46405bdfae4875b0473394d7a620 ba63deb35831759fb6e6bf4fdf85c679 0c5dc26184bb3e853625a2470cd6a48a 51a4d0c3064b6c788e87a3d5727327ea` |

**Vector 4** — [Seed(1000000): First 8 outputs - large seed value](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `40420f0000000000` |
| `outputSize` | `64` |
| `input` | `null` |
| `expected` | `d52118fd7bfadb0da4ad2bb4efcc4314 2184447d9a8874f883a7aba09f5b1225 cef92f21c2b56863a2af0eb1790f3e00 cf8ff1667ca73fe8b94bcfbfe165ff7d` |

**Vector 5** — [Seed(0xDEADBEEFCAFEBABE): First 5 outputs - hex seed pattern](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `bebafecaefbeadde` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `f4800a9fbf57297d3641b0846ba6fc25 ff7044feb40db26f362ef881bbc1f152 bcd0cc19a888450b` |

**Vector 6** — [Seed(0xFFFFFFFFFFFFFFFF): First 5 outputs - maximum seed](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `ffffffffffffffff` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `000000c6e5c92cf9e3ae1efdd884f48f c6ab6f32f3956c34c0f2c5379ccc56c5 071a10833f652d6c` |

---

[← All algorithms](../README.md)
