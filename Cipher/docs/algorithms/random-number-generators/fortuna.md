# Fortuna

> Fortuna is a cryptographically secure PRNG designed by Niels Ferguson and Bruce Schneier. Uses 32 SHA-256 entropy pools with exponential pool scheduling and AES-256 counter mode for output generation.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Cryptographic PRNG |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | Niels Ferguson, Bruce Schneier |
| Year | 2003 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/fortuna.js`](../../../algorithms/random/fortuna.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 0 bytes (0 bits) to 1024 bytes (8192 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | Yes |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [Practical Cryptography - Ferguson and Schneier (2003)](https://www.schneier.com/books/practical-cryptography/)
- [LibTomCrypt Implementation](https://github.com/libtom/libtomcrypt/blob/develop/src/prngs/fortuna.c)
- [Fortuna Design Analysis](https://www.schneier.com/academic/paperfiles/fortuna.pdf)

## References

- [Wikipedia: Fortuna PRNG](https://en.wikipedia.org/wiki/Fortuna_(PRNG))
- [LibTomCrypt Documentation](https://www.libtom.net/LibTomCrypt/)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Deterministic test - 64 bytes entropy pattern, generate 32 bytes](https://github.com/libtom/libtomcrypt/blob/develop/src/prngs/fortuna.c)

| Field | Value |
| --- | --- |
| `seed` | `0123456789abcdef0123456789abcdef 0123456789abcdef0123456789abcdef 0123456789abcdef0123456789abcdef 0123456789abcdef0123456789abcdef` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `224a0fa0d0a71441a7190c4b9fdb0d8660905d0f5f390906ca61d2c469f4b886` |

**Vector 2** — [Multiple block test - 128 bytes sequential entropy, generate 64 bytes](https://github.com/libtom/libtomcrypt/blob/develop/src/prngs/fortuna.c)

| Field | Value |
| --- | --- |
| `seed` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f` |
| `outputSize` | `64` |
| `input` | `null` |
| `expected` | `667dbf72dbf3a8b403512fc0e26ec57f 8b3ea2a5bd5efd0cf33b76dcfcf5bdd0 f181a1459a23164744c27c2655b296dd abf72282dd08fd7c01375758cacca9ba` |

---

[← All algorithms](../README.md)
