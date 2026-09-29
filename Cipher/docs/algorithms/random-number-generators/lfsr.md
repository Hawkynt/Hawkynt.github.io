# LFSR

> Linear Feedback Shift Register is a fundamental pseudo-random sequence generator widely used in hardware testing, stream ciphers, and error correction. Uses shift-and-XOR operations with a primitive polynomial to generate maximal-length sequences with period 2^n-1.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Deterministic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Solomon W. Golomb (formalized) |
| Year | 1967 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/lfsr.js`](../../../algorithms/random/lfsr.js) |

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

- [Golomb: Shift Register Sequences (1967)](https://www.worldcat.org/title/shift-register-sequences/oclc/439134)
- [Philip Koopman: Maximal Length LFSR Feedback Terms](https://users.ece.cmu.edu/~koopman/lfsr/)
- [Stahnke: Primitive Binary Polynomials (1973)](https://www.ams.org/journals/mcom/1973-27-124/S0025-5718-1973-0327722-7/)
- [Analog Devices: PRNG Using LFSR](https://www.analog.com/en/resources/design-notes/random-number-generation-using-lfsr.html)
- [Wikipedia: Linear-feedback shift register](https://en.wikipedia.org/wiki/Linear-feedback_shift_register)

## References

- [Watson: Primitive Polynomials (Mod 2) - 1962](https://www.ams.org/journals/mcom/1962-16-079/S0025-5718-1962-0148256-1/)
- [Živković: A Table of Primitive Binary Polynomials (1994)](https://www.sciencedirect.com/science/article/pii/0025561694900647)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed 0x0000000000000042: First 8 bytes - minimal seed with tapped bits set](https://users.ece.cmu.edu/~koopman/lfsr/)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000042` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `2100000000000000` |

**Vector 2** — [Seed 0x0123456789ABCDEF: First 8 bytes - standard test pattern](https://users.ece.cmu.edu/~koopman/lfsr/)

| Field | Value |
| --- | --- |
| `seed` | `0123456789abcdef` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `f7e6d5c4b3a29180` |

**Vector 3** — [Seed 0xFFFFFFFFFFFFFFFF: First 8 bytes - all ones seed](https://users.ece.cmu.edu/~koopman/lfsr/)

| Field | Value |
| --- | --- |
| `seed` | `ffffffffffffffff` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `ffffffffffffffff` |

**Vector 4** — [Seed 0x0123456789ABCDEF: First 16 bytes - sequence continuation test](https://users.ece.cmu.edu/~koopman/lfsr/)

| Field | Value |
| --- | --- |
| `seed` | `0123456789abcdef` |
| `outputSize` | `16` |
| `input` | `null` |
| `expected` | `f7e6d5c4b3a2918080691bb1a25b9478` |

**Vector 5** — [Seed 0x8000000000000000: First 8 bytes - high bit set](https://users.ece.cmu.edu/~koopman/lfsr/)

| Field | Value |
| --- | --- |
| `seed` | `8000000000000000` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `0000000000000040` |

**Vector 6** — [Seed 0xAAAAAAAAAAAAAAAA: First 8 bytes - alternating bit pattern](https://users.ece.cmu.edu/~koopman/lfsr/)

| Field | Value |
| --- | --- |
| `seed` | `aaaaaaaaaaaaaaaa` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `55555555555555d5` |

**Vector 7** — [Seed 0x1111111111111111: First 8 bytes - sparse bit pattern](https://users.ece.cmu.edu/~koopman/lfsr/)

| Field | Value |
| --- | --- |
| `seed` | `1111111111111111` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `8888888888888808` |

---

[← All algorithms](../README.md)
