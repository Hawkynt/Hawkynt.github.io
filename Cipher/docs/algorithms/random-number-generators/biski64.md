# biski64

> biski64 is a very fast, high-quality 64-bit PRNG with 192-bit state combining a Weyl sequence with rotation-based mixing functions. It guarantees minimum period of 2^64 through proven injectivity and passes BigCrush and PractRand statistical tests. Designed for both single-threaded and parallel applications with exceptional performance.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Non-Cryptographic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Daniel Cota |
| Year | 2025 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/biski64.js`](../../../algorithms/random/biski64.js) |

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

- [Official GitHub Repository](https://github.com/danielcota/biski64)
- [C Reference Implementation](https://github.com/danielcota/biski64/tree/main/c)
- [Rust Implementation (crates.io)](https://crates.io/crates/biski64)

## References

- [PractRand Statistical Testing Suite](http://pracrand.sourceforge.net/)
- [TestU01 BigCrush Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)
- [Design Parameters and Analysis](https://github.com/danielcota/biski64#design-parameters)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed=0: First five 64-bit outputs (verified against C reference)](https://github.com/danielcota/biski64)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `0c89ec27d6f6deb3480d14acdb6dd755 a956f8213e8036fbb31a828a3c4ff972 7f3704a8c3956b43` |

**Vector 2** — [Seed=1: First five 64-bit outputs](https://github.com/danielcota/biski64)

| Field | Value |
| --- | --- |
| `seed` | `01` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `6b67c277227bdf8de2c9215a1a382289 ba3902db374aa0aa80ada2e1a2a0769d 62efd36d4878e6af` |

**Vector 3** — [Seed=12345: First five 64-bit outputs](https://github.com/danielcota/biski64)

| Field | Value |
| --- | --- |
| `seed` | `3930` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `1abb804492c09d2ed947f0f2f2b3d28f bdb884622cf8bb170f4079403772a29d a154733485f249df` |

**Vector 4** — [Seed=0xDEADBEEF: First five 64-bit outputs](https://github.com/danielcota/biski64)

| Field | Value |
| --- | --- |
| `seed` | `efbeadde` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `71f017b36988261245aec3c31eacf8c2 005689f091e6f3d9f86cf5dd0d3e23b2 4497b4928abc68be` |

---

[← All algorithms](../README.md)
