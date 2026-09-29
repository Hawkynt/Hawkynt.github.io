# Shrinking Generator

> LFSR-based stream cipher using irregular decimation by Coppersmith, Krawczyk, and Mansour. Uses two LFSRs where one controls bit selection from the other.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Don Coppersmith, Hugo Krawczyk, Yishay Mansour |
| Year | 1993 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/stream/shrinking-generator.js`](../../../algorithms/stream/shrinking-generator.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Variable Output Rate](https://link.springer.com/chapter/10.1007/3-540-48329-2_3) | Output rate varies irregularly which can leak information about internal state | Use output buffering to mask timing variations |
| [Known Polynomial Attack](https://www.researchgate.net/publication/277919628_Cryptanalysing_the_Shrinking_Generator) | If LFSR feedback polynomials are known, attacks require less than A*S bits of output | Keep feedback polynomials secret and use strong polynomial selection |

## Documentation

- [The Shrinking Generator (CRYPTO '93)](https://link.springer.com/chapter/10.1007/3-540-48329-2_3)
- [Shrinking Generator - Wikipedia](https://en.wikipedia.org/wiki/Shrinking_generator)

## References

- [Cryptanalysing the Shrinking Generator](https://www.researchgate.net/publication/277919628_Cryptanalysing_the_Shrinking_Generator)
- [Linearity in decimation-based generators](https://www.degruyter.com/document/doi/10.1515/math-2018-0058/html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Shrinking Generator - Zero key test vector

Source: Generated from CRYPTO '93 algorithm specification

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000001` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `0023f77c58e03cf399e9e63b6981cb3b` |

**Vector 2** — Shrinking Generator - Pattern key test vector

Source: Generated from CRYPTO '93 algorithm specification

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdef0123456789abcdef` |
| `input` | `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` |
| `expected` | `fdfd69daf7ac95f9ef7c03500d464010` |

**Vector 3** — Shrinking Generator - Full key test vector

Source: Generated from CRYPTO '93 algorithm specification

| Field | Value |
| --- | --- |
| `key` | `fedcba9876543210fedcba9876543210` |
| `input` | `ffffffffffffffffffffffffffffffff` |
| `expected` | `49839f0a11c8cb4613becb4e92c6c6d1` |

---

[← All algorithms](../README.md)
