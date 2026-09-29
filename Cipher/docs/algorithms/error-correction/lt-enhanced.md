# LT Enhanced

> Enhanced Luby Transform codes with systematic encoding, pre-coding, and inactivation decoding. First practical rateless fountain code with Robust Soliton distribution. Provides O(n log n) encoding/decoding complexity. Supports large source blocks (K=1000+) with advanced belief propagation decoder and Gaussian elimination fallback.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Fountain Code |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Michael Luby |
| Year | 2002 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/luby-transform-enhanced.js`](../../../algorithms/ecc/luby-transform-enhanced.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `supportsContinuousEncoding` | Yes |
| `supportsRateless` | Yes |
| `supportsSystematic` | Yes |
| `supportsInactivation` | Yes |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [LT Codes - Original Paper (2002)](https://pages.cs.wisc.edu/~suman/courses/740/papers/luby02lt.pdf)
- [Digital Fountain Codes Survey](https://zoo.cs.yale.edu/classes/cs434/cs434-2018-spring/readings/fountain-codes.pdf)
- [RFC 5053 - Raptor FEC (LT-based)](https://datatracker.ietf.org/doc/html/rfc5053)
- [Error Correction Zoo - LT Codes](https://errorcorrectionzoo.org/c/luby_transform)
- [Systematic LT Codes Paper](https://ietresearch.onlinelibrary.wiley.com/doi/full/10.1049/el.2019.4258)

## References

- [anrosent LT-code Rust Port (lt-rs)](https://github.com/anrosent/lt-rs)
- [Founsure Precoded LT Fountain Code Library](https://github.com/suaybarslan/founsure)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — LT Enhanced: K=4, systematic, c=0.1, delta=0.5

Source: Robust Soliton distribution with seed=12345

| Field | Value |
| --- | --- |
| `k` | `4` |
| `overhead` | `0.5` |
| `c` | `0.1` |
| `delta` | `0.5` |
| `seed` | `12345` |
| `systematic` | Yes |
| `input` | `48656c6c` |
| `expected` | `48656c6c656c` |

**Vector 2** — LT Enhanced: K=8, systematic, overhead=37.5%

Source: Standard parameters c=0.1, delta=0.5, seed=54321

| Field | Value |
| --- | --- |
| `k` | `8` |
| `overhead` | `0.375` |
| `c` | `0.1` |
| `delta` | `0.5` |
| `seed` | `54321` |
| `systematic` | Yes |
| `input` | `0102030405060708` |
| `expected` | `0102030405060708010302` |

**Vector 3** — LT Enhanced: K=16, demonstrating degree-1 recovery

Source: Belief propagation decoder with seed=11111

| Field | Value |
| --- | --- |
| `k` | `16` |
| `overhead` | `0.25` |
| `c` | `0.1` |
| `delta` | `0.5` |
| `seed` | `11111` |
| `systematic` | Yes |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `000102030405060708090a0b0c0d0e0f09090a09` |

---

[← All algorithms](../README.md)
