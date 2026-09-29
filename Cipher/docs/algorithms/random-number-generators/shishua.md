# SHISHUA

> SHISHUA is the fastest PRNG in the world, achieving 0.06 cycles per byte on modern x86-64 processors. Designed by Thaddée Tyl using a shift-shuffle-add pattern with large state (16 x 64-bit), it passes PractRand beyond 32 TiB while delivering exceptional speed.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | High-Performance PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Thaddée Tyl |
| Year | 2020 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/random/shishua.js`](../../../algorithms/random/shishua.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 32 bytes (256 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [SHISHUA Official Repository](https://github.com/espadrine/shishua)
- [Blog Post: SHISHUA - The Fastest PRNG In The World](https://espadrine.github.io/blog/posts/shishua-the-fastest-prng-in-the-world.html)
- [Reference C Implementation (Scalar)](https://github.com/espadrine/shishua/blob/master/shishua.h)
- [Official Test Vectors](https://github.com/espadrine/shishua/blob/master/test-vectors.h)

## References

- [PractRand Statistical Testing Suite](http://pracrand.sourceforge.net/)
- [BigCrush Test Suite (TestU01)](http://simul.iro.umontreal.ca/testu01/tu01.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed Zero: First 128 bytes (official test vector)](https://github.com/espadrine/shishua/blob/master/test-vectors.h)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `outputSize` | `128` |
| `input` | `null` |
| `expected` | `955d96f90fb4aa53092d82e63a7c09e2 2ca5a4a5a75a5a39dc68b4125de7ce2b 6b6efef58bd9cc4212dd744e81fd18b9 58f0625d38efcc1b6fdb0da336f7e5ee 6bdbe8ea5cda40c75344d0d5bfc1d507 e02cf51208711bea8882cfd6ccf71d06 62c75ef1985df2c6d56d3d2e35dad685 3ac176b74db7e026512dce348ba603f1` |

**Vector 2** — [Seed Pi: First 128 bytes (digits of pi as seed)](https://github.com/espadrine/shishua/blob/master/test-vectors.h)

| Field | Value |
| --- | --- |
| `seed` | `243f6a8885a308d313198a2e03707344a409382229f31d0082efa98ec4e6c894` |
| `outputSize` | `128` |
| `input` | `null` |
| `expected` | `fa62a926dc1fbf00f13ce868459b6f74 4bbf2b57505ed8160e4ed92a2ef6965c 01b5c9e79d84d8d95f0db74a47f4acc8 25cc0b2e3b90030a1d443cd827a842e0 6e8fa0c1b28e183de393067911dc9293 0d85acdedbb32304d0befe74efbbbf19 c1150a347845a22793b7b24d4b4f6eb6 c0dc42546a9bcd5073faa19cb4d1d287` |

**Vector 3** — [Seed Zero: 512 bytes (extended output test)](https://github.com/espadrine/shishua/blob/master/test-vectors.h)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `outputSize` | `512` |
| `input` | `null` |
| `expected` | `955d96f90fb4aa53092d82e63a7c09e2 2ca5a4a5a75a5a39dc68b4125de7ce2b 6b6efef58bd9cc4212dd744e81fd18b9 58f0625d38efcc1b6fdb0da336f7e5ee …` (512 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
