# Xorshift64

> Xorshift64 is a very fast pseudo-random number generator invented by George Marsaglia. It uses three xorshift operations on a single 64-bit state to generate random numbers with a period of 2^64-1. Commonly used in game engines and simulations.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Xorshift Family |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | George Marsaglia |
| Year | 2003 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/xorshift64.js`](../../../algorithms/random/xorshift64.js) |

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

- [Original Paper: Xorshift RNGs (Marsaglia, 2003)](https://www.jstatsoft.org/article/view/v008i14)
- [Wikipedia: Xorshift](https://en.wikipedia.org/wiki/Xorshift)
- [Analysis by Sebastiano Vigna](https://vigna.di.unimi.it/ftp/papers/xorshift.pdf)
- [Reference Implementation (Stack Overflow)](https://stackoverflow.com/questions/53886131/how-does-xorshift32-works)

## References

- [TestU01 Statistical Testing Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)
- [Modern PRNG Alternatives (xoshiro/xoroshiro)](https://prng.di.unimi.it/)
- [Note on Marsaglia's Xorshift RNGs (Panneton and L'Ecuyer)](https://www.iro.umontreal.ca/~lecuyer/myftp/papers/xorshift.pdf)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed 1: First 5 outputs (40 bytes) - verified against reference C implementation](https://www.jstatsoft.org/article/view/v008i14)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000001` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `0000000040822041100041060c011441 9b1e842f6e862629f554f503555d8025 860c1fb090599265` |

**Vector 2** — [Seed 88172645463325252: First 3 outputs (24 bytes) - from Marsaglia's examples](https://www.jstatsoft.org/article/view/v008i14)

| Field | Value |
| --- | --- |
| `seed` | `0139408dcbbf7a44` |
| `outputSize` | `24` |
| `input` | `null` |
| `expected` | `79690975fbde15b02a337357ae2cc59b2fef107a27529ad0` |

**Vector 3** — [Seed 12345: First 5 outputs (40 bytes) - common test seed](https://vigna.di.unimi.it/ftp/papers/xorshift.pdf)

| Field | Value |
| --- | --- |
| `seed` | `0000000000003039` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `00000c163a391e199c0eb9542f03ca65 a228090ad781f4b120f578d6eaf5fb18 7b76f0b8e8e1d6ee` |

**Vector 4** — [Seed 0 (becomes 1): First 5 outputs (40 bytes) - zero seed handling](https://www.jstatsoft.org/article/view/v008i14)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `0000000040822041100041060c011441 9b1e842f6e862629f554f503555d8025 860c1fb090599265` |

**Vector 5** — [Seed 9223372036854775807 (max int64): First 5 outputs - large seed value](https://vigna.di.unimi.it/ftp/papers/xorshift.pdf)

| Field | Value |
| --- | --- |
| `seed` | `7fffffffffffffff` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `810000003f801fc08ffdbffe03feefff ce8fc004c67d0de0ba17a467eef88ffb 901172f84eb1e024` |

---

[← All algorithms](../README.md)
