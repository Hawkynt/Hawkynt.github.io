# Blum Blum Shub

> Blum Blum Shub (BBS) is a cryptographically secure pseudo-random number generator based on the difficulty of factoring and the quadratic residuosity problem. It generates random bits by repeatedly squaring a value modulo a Blum integer (product of two primes ≡ 3 mod 4).

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Cryptographic PRNG |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Lenore Blum, Manuel Blum, Michael Shub |
| Year | 1986 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/blumblumshub.js`](../../../algorithms/random/blumblumshub.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 1 byte (8 bits) to 1024 bytes (8192 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | Yes |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [Original Paper: A Simple Unpredictable Pseudo-Random Number Generator (1986)](https://shub.ccny.cuny.edu/articles/1986-A_simple_unpredictable_pseudo-random_number_generator.pdf)
- [Crypto++ Implementation](https://github.com/weidai11/cryptopp/blob/master/blumshub.cpp)
- [Wikipedia: Blum Blum Shub](https://en.wikipedia.org/wiki/Blum_Blum_Shub)

## References

- [Handbook of Applied Cryptography - Section 5.5.2](http://cacr.uwaterloo.ca/hac/)
- [A Security Site: Blum Blum Shub](https://asecuritysite.com/encryption/blum)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Classic example: p=11, q=23, seed=3 (commonly cited)](https://en.wikipedia.org/wiki/Blum_Blum_Shub)

| Field | Value |
| --- | --- |
| `p` | `11` |
| `q` | `23` |
| `seed` | `03` |
| `outputSize` | `2` |
| `input` | `null` |
| `expected` | `43b8` |

**Vector 2** — [Smaller example: p=7, q=11, seed=5](https://asecuritysite.com/encryption/blum)

| Field | Value |
| --- | --- |
| `p` | `7` |
| `q` | `11` |
| `seed` | `05` |
| `outputSize` | `2` |
| `input` | `null` |
| `expected` | `9999` |

**Vector 3** — [Larger primes: p=499, q=547 (both ≡ 3 mod 4), seed=42](https://github.com/weidai11/cryptopp/blob/master/blumshub.cpp)

| Field | Value |
| --- | --- |
| `p` | `499` |
| `q` | `547` |
| `seed` | `2a` |
| `outputSize` | `4` |
| `input` | `null` |
| `expected` | `a280777a` |

---

[← All algorithms](../README.md)
