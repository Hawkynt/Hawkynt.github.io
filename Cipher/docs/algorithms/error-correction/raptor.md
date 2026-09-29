# Raptor

> Raptor codes are systematic fountain codes that achieve near-optimal performance by combining a high-rate pre-code (typically LDPC) with LT codes. They provide excellent error correction with minimal overhead and linear encoding/decoding complexity, making them suitable for broadcast and multicast applications.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Fountain Codes |
| Security status | 🛡️ Secure |
| Complexity | Expert |
| Inventor | Amin Shokrollahi |
| Year | 2006 |
| Origin | 🇨🇭 Switzerland |
| Source | [`algorithms/ecc/raptor-codes.js`](../../../algorithms/ecc/raptor-codes.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Block sizes | 4 bytes (32 bits) to 1048576 bytes (8388608 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `supportsContinuousEncoding` | Yes |
| `supportsRateless` | Yes |
| `isSystematic` | Yes |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [Raptor Codes](https://en.wikipedia.org/wiki/Raptor_code)
- [Digital Fountain Codes](https://ieeexplore.ieee.org/document/1490914)
- [LDPC and Fountain Codes](https://www.cambridge.org/core/books/modern-coding-theory/)

## References

- [Google gofountain Raptor Implementation (RFC 5053)](https://github.com/google/gofountain/blob/master/raptor.go)
- [Raptor-Codes-rfc5053 C++ Implementation](https://github.com/RabbitNick/Raptor-Codes-rfc5053)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Raptor encoding test with 8 source symbols

Source: Reference implementation test vector

| Field | Value |
| --- | --- |
| `k` | `8` |
| `preCodeRate` | `0.95` |
| `targetOverhead` | `0.05` |
| `seed` | `42` |
| `input` | `48656c6c6f20576f` |
| `expected` | `48656c6c6f20576f03` |

**Vector 2** — Raptor encoding test with 64 source symbols

Source: Reference implementation test vector

| Field | Value |
| --- | --- |
| `k` | `64` |
| `preCodeRate` | `0.9` |
| `targetOverhead` | `0.1` |
| `seed` | `314159` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 333e1e191e110701` |

---

[← All algorithms](../README.md)
