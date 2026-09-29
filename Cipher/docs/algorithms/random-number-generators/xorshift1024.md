# Xorshift1024*

> Xorshift1024* is a large-state xorshift pseudo-random number generator with multiplicative scrambling by Sebastiano Vigna. Uses 1024 bits of state for a period of 2^1024-1, making it suitable for parallel applications. Features golden ratio multiplier for output quality.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Non-Cryptographic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Sebastiano Vigna |
| Year | 2014 |
| Origin | 🇮🇹 Italy |
| Source | [`algorithms/random/xorshift1024star.js`](../../../algorithms/random/xorshift1024star.js) |

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

- [Official Reference Implementation (C)](https://prng.di.unimi.it/xorshift1024star.c)
- [Xorshift Generators Homepage](https://prng.di.unimi.it/xorshift.php)
- [Original Paper: An experimental exploration of Marsaglia's xorshift generators (2014)](https://arxiv.org/abs/1402.6246)
- [Further Scramblings of Marsaglia's Xorshift Generators](https://vigna.di.unimi.it/ftp/papers/xorshiftplus.pdf)

## References

- [Wikipedia: Xorshift](https://en.wikipedia.org/wiki/Xorshift)
- [TestU01 Statistical Testing Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)
- [DSI Utilities - Java Implementation](https://dsiutils.di.unimi.it/docs/it/unimi/dsi/util/XorShift1024StarPhiRandom.html)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed=1: First four 64-bit outputs from xorshift1024* (official reference)](https://prng.di.unimi.it/xorshift1024star.c)

| Field | Value |
| --- | --- |
| `seed` | `0100000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `ebec18c6c320b75ff0c3e55baa47687a9fda494782f91f6578beb9d0157ed311` |

**Vector 2** — [Seed=0: First four 64-bit outputs (zero seed initialization)](https://prng.di.unimi.it/xorshift1024star.c)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `d66fb9683583763f7e3e02cd0d1b704985bbd386166f265f7da6a5f93a72f14d` |

**Vector 3** — [Seed=12345: First four 64-bit outputs](https://prng.di.unimi.it/xorshift1024star.c)

| Field | Value |
| --- | --- |
| `seed` | `3930000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `f0eb9cd17d61a08e9a889e3235eae19970744689e4cf1fda4b9d595ecb44b440` |

**Vector 4** — [Seed=0xDEADBEEF: First four 64-bit outputs](https://prng.di.unimi.it/xorshift1024star.c)

| Field | Value |
| --- | --- |
| `seed` | `efbeadde00000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `3fae770327913ba438267944642a8ba9c7c06767d60c319e99cad00ed5565195` |

**Vector 5** — [Seed=1000000: First six 64-bit outputs (large seed test)](https://prng.di.unimi.it/xorshift1024star.c)

| Field | Value |
| --- | --- |
| `seed` | `40420f0000000000` |
| `outputSize` | `48` |
| `input` | `null` |
| `expected` | `e7438768d321bb87a6ae572109ee2388 0f85c9c0cd4bde5c0603680e40371b26 d201f4cf7f0e9e870a034214cfa6af09` |

**Vector 6** — [Seed=0xFFFFFFFFFFFFFFFF: Maximum seed value test](https://prng.di.unimi.it/xorshift1024star.c)

| Field | Value |
| --- | --- |
| `seed` | `ffffffffffffffff` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `ff8b751a747b5b338dff602bc75ead46e4dc5b1ab29c51f528f5a435034c4f00` |

---

[← All algorithms](../README.md)
