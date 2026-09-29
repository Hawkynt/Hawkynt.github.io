# Philox4x32-10

> Counter-based PRNG using integer multiplication in a Feistel-like network. Trivially parallelizable with 2^128 period, passes all TestU01 statistical tests. Part of the Random123 library by D. E. Shaw Research.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Counter-Based PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | John K. Salmon, Mark A. Moraes, Ron O. Dror, David E. Shaw |
| Year | 2011 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/philox.js`](../../../algorithms/random/philox.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 8 bytes (64 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |
| `IsCounterBased` | Yes |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Original Paper: Parallel Random Numbers: As Easy as 1, 2, 3 (SC11, 2011)](https://www.thesalmons.org/john/random123/papers/random123sc11.pdf)
- [Random123 Library Documentation](https://www.thesalmons.org/john/random123/releases/latest/docs/index.html)
- [Random123 GitHub Repository](https://github.com/DEShawResearch/random123)
- [Philox Header Reference](https://www.thesalmons.org/john/random123/releases/1.08/docs/philox_8h_source.html)

## References

- [TestU01 Statistical Testing Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)
- [Intel MKL Philox4x32-10 Documentation](https://www.intel.com/content/www/us/en/docs/onemkl/developer-reference-vector-statistics-notes/2021-1/philox4x32-10.html)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Philox4x32-10: Counter=0, Key=0 - Random123 kat_vectors](https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000` |
| `outputSize` | `16` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `d5e827668dc569e14cac57bcd8db009b` |

**Vector 2** — [Philox4x32-10: Counter=0xFFFFFFFF (all), Key=0xFFFFFFFF (all) - Random123 kat_vectors](https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffff` |
| `outputSize` | `16` |
| `input` | `ffffffffffffffffffffffffffffffff` |
| `expected` | `6d278f400e3bc841c6c70ba2fd51546d` |

**Vector 3** — [Philox4x32-10: Counter=π digits, Key=π digits - Random123 kat_vectors](https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors)

| Field | Value |
| --- | --- |
| `key` | `223809a4d0319f29` |
| `outputSize` | `16` |
| `input` | `886a3f24d308a3852e8a191344737003` |
| `expected` | `09fe6cd1ebccfd9420e40150a16e1224` |

**Vector 4** — [Philox4x32-10: Counter=(1,0,0,0), Key=(0,0) - Counter variation](https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000` |
| `outputSize` | `16` |
| `input` | `01000000000000000000000000000000` |
| `expected` | `a4cce4f8db00b25ceb74a5b167ff7e09` |

**Vector 5** — [Philox4x32-10: Counter=(0,0,0,0), Key=(1,0) - Key variation](https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors)

| Field | Value |
| --- | --- |
| `key` | `0100000000000000` |
| `outputSize` | `16` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `7006e8e3bc0e0ae5c022f29527aa15b6` |

---

[← All algorithms](../README.md)
