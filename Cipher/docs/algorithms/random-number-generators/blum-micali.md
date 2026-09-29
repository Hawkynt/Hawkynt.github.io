# Blum-Micali

> Blum-Micali is a cryptographically secure pseudo-random bit generator based on the difficulty of computing discrete logarithms. It generates random bits by iteratively computing g^x mod p where g is a primitive root and p is a large prime, extracting one bit per iteration based on whether the result is in the lower or upper half of the range.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Cryptographic PRNG |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Manuel Blum, Silvio Micali |
| Year | 1984 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/blum-micali.js`](../../../algorithms/random/blum-micali.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 1 byte (8 bits) to 128 bytes (1024 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | Yes |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [Original Paper: How to Generate Cryptographically Strong Sequences of Pseudo Random Bits (1982)](https://apps.dtic.mil/sti/pdfs/ADA114854.pdf)
- [Wikipedia: Blum-Micali Algorithm](https://en.wikipedia.org/wiki/Blum%E2%80%93Micali_algorithm)
- [Handbook of Applied Cryptography - Section 5.4.2](http://cacr.uwaterloo.ca/hac/)

## References

- [Introduction to Modern Cryptography by Katz and Lindell](https://www.cs.umd.edu/~jkatz/imc.html)
- [Lecture Notes on Pseudorandom Generators](https://www.cs.princeton.edu/courses/archive/spr05/cos598D/scribe1.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Small parameters: p=23, g=5 (primitive root), seed=3](https://en.wikipedia.org/wiki/Blum%E2%80%93Micali_algorithm)

| Field | Value |
| --- | --- |
| `p` | `23` |
| `g` | `5` |
| `seed` | `03` |
| `outputSize` | `2` |
| `input` | `null` |
| `expected` | `1390` |

**Vector 2** — [Medium parameters: p=47, g=5, seed=7](https://www.cs.princeton.edu/courses/archive/spr05/cos598D/scribe1.pdf)

| Field | Value |
| --- | --- |
| `p` | `47` |
| `g` | `5` |
| `seed` | `07` |
| `outputSize` | `4` |
| `input` | `null` |
| `expected` | `38e38e38` |

**Vector 3** — [Default C# parameters: p=6364136223846793005, g=2147483647, seed=42](https://github.com/Hawkynt/C--FrameworkExtensions/blob/master/Hawkynt.RandomNumberGenerators/Cryptographic/BlumMicali.cs)

| Field | Value |
| --- | --- |
| `p` | `6364136223846793005` |
| `g` | `2147483647` |
| `seed` | `2a` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `a72d9f96f3d03622` |

---

[← All algorithms](../README.md)
