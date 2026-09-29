# Lehmer128

> Lehmer128 is a 128-bit multiplicative congruential generator (MCG) considered the minimal standard for modern 64-bit PRNGs. Based on Lehmer's original MCG (1951) with a carefully chosen multiplier from PCG research providing excellent spectral properties. It passes BigCrush and PractRand tests up to 32 TB, making it the simplest PRNG suitable for serious use.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Multiplicative Congruential Generator |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | D. H. Lehmer (original), optimized variant |
| Year | 1951 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/lehmer128.js`](../../../algorithms/random/lehmer128.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 1 byte (8 bits) to 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [D. H. Lehmer: Mathematical methods in large-scale computing units (1951)](https://doi.org/10.2307/2002781)
- [PCG Random: Does it beat the minimal standard?](https://www.pcg-random.org/posts/does-it-beat-the-minimal-standard.html)
- [P. L'Ecuyer: Tables of linear congruential generators (1999)](https://doi.org/10.1090/S0025-5718-99-00996-5)

## References

- [TestU01: BigCrush Statistical Testing Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)
- [PractRand: Practical Random Number Generator Testing](http://pracrand.sourceforge.net/)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed 1 (SplitMix64 initialization): First 5 outputs](https://www.pcg-random.org/posts/does-it-beat-the-minimal-standard.html)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000001` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `c63f51f8161177a4e6aecdfdf79bc7d4 8c9cbc663aeb810975a8d07cef123243 f567b888929801d9` |

**Vector 2** — [Seed 0 (SplitMix64 initialization): First 5 outputs](https://www.pcg-random.org/posts/does-it-beat-the-minimal-standard.html)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `8b0f2b375c2d67c74c1d2980cd9389d4 4cd926f3f2f9ddab04e60c22ee2f62ef 143862ac141e19d3` |

**Vector 3** — [Seed 42 (SplitMix64 initialization): First 5 outputs](https://www.pcg-random.org/posts/does-it-beat-the-minimal-standard.html)

| Field | Value |
| --- | --- |
| `seed` | `000000000000002a` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `85b9aac0926bdc09599b8a2e6781aedf 539f0aa577fab11f1b382c2f9e57b996 e86006e444071702` |

**Vector 4** — [Direct state 0x123456789ABCDEF0123456789ABCDEF0: First 3 outputs](https://www.pcg-random.org/posts/does-it-beat-the-minimal-standard.html)

| Field | Value |
| --- | --- |
| `state` | `123456789abcdef0123456789abcdef0` |
| `outputSize` | `24` |
| `input` | `null` |
| `expected` | `b66df1da3bd6e94cd8b959473b03b16211208f133bafce12` |

**Vector 5** — [State initialized to 1 (minimal non-zero state): First 10 outputs](https://www.pcg-random.org/posts/does-it-beat-the-minimal-standard.html)

| Field | Value |
| --- | --- |
| `state` | `00000000000000000000000000000001` |
| `outputSize` | `80` |
| `input` | `null` |
| `expected` | `0fc94e3bf4e9ab329f4c53132cb5b55a 04f16bbaa6c209fe9c0827f89f0f242f 5b5349ddf2ca02869a09a2d3e4f52267 f4e9e997e821367bd23cf34fc72f4155 56a2d7e343d7f1b573b5f20e34a8238c` |

---

[← All algorithms](../README.md)
