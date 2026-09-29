# TinyMT (Tiny Mersenne Twister)

> TinyMT32 is a compact variant of Mersenne Twister with 127-bit state and period of 2^127-1. Designed for embedded systems where MT19937's large state is impractical, it passes rigorous statistical tests while using minimal memory.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Pseudo-Random Number Generator |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Mutsuo Saito and Makoto Matsumoto |
| Year | 2011 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/random/tinymt.js`](../../../algorithms/random/tinymt.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 4 bytes (32 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 8682: TinyMT32 PRNG Specification](https://datatracker.ietf.org/doc/rfc8682/)
- [Official GitHub Repository](https://github.com/MersenneTwister-Lab/TinyMT)
- [TinyMT Homepage (Hiroshima University)](http://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/TINYMT/index.html)
- [Original Paper: A fast jump ahead algorithm for linear recurrences](https://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/ARTICLES/tinymt.pdf)

## References

- [Reference Implementation (C code)](https://github.com/MersenneTwister-Lab/TinyMT/blob/master/tinymt/tinymt32.c)
- [Precalculated Parameter Sets](https://github.com/jj1bdx/tinymtdc-longbatch)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [TinyMT32 with seed 1 (RFC 8682 test vector, first 10 outputs)](https://datatracker.ietf.org/doc/rfc8682/)

| Field | Value |
| --- | --- |
| `seed` | `01000000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `25d6b697e1e2863ab10573ddb0f14e8e 15550ad6f651b7e33631077e8bdfe582 a8b3e6a5edde912d` |

**Vector 2** — [TinyMT32 with seed 1 (RFC 8682 extended test, outputs 11-20)](https://datatracker.ietf.org/doc/rfc8682/)

| Field | Value |
| --- | --- |
| `seed` | `01000000` |
| `skipBytes` | `40` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `d3235626bbdd9f6c3e838b34be20c2fa 681bf5db87a626c1d2be21ae633a85ed b0faecf30b96a202` |

**Vector 3** — [TinyMT32 with seed 1 (RFC 8682 extended test, outputs 21-30)](https://datatracker.ietf.org/doc/rfc8682/)

| Field | Value |
| --- | --- |
| `seed` | `01000000` |
| `skipBytes` | `80` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `cf0a6f8223b05ead288b586d71e8fce0 b36601b4d67153f2fe51e54965248cf0 d4ed60cbd366f320` |

---

[← All algorithms](../README.md)
