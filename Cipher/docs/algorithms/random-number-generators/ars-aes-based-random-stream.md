# ARS (AES-based Random Stream)

> Counter-based PRNG using full AES round function with simplified Weyl-sequence key schedule. Designed for parallel computing with cryptographic-quality randomness. Part of the Random123 library by D. E. Shaw Research.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Counter-Based PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | John K. Salmon, Mark A. Moraes, Ron O. Dror, David E. Shaw |
| Year | 2011 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/ars.js`](../../../algorithms/random/ars.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |

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
- [ARS Header Reference](https://www.thesalmons.org/john/random123/releases/1.08/docs/ars_8h_source.html)

## References

- [NIST FIPS 197: AES Specification](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197.pdf)
- [AES Round Functions Explanation](https://en.wikipedia.org/wiki/Advanced_Encryption_Standard#Description_of_the_cipher)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ARS4x32-10: Counter=0, Key=0 - Random123 kat_vectors](https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `rounds` | `10` |
| `outputSize` | `16` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `19ee738def016450e4dbc2130d9cbe0c` |

**Vector 2** — [ARS4x32-10: Counter=π digits, Key=π digits - Random123 kat_vectors](https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors)

| Field | Value |
| --- | --- |
| `key` | `223809a4d0319f2998fa2e08896c4eec` |
| `rounds` | `10` |
| `outputSize` | `16` |
| `input` | `886a3f24d308a3852e8a191344737003` |
| `expected` | `d6e716a574ad5783ecb3595bf3ff6387` |

**Vector 3** — [ARS4x32-10: Counter=0xFFFFFFFF (all), Key=mixed - Random123 kat_vectors](https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffff0000000000000000` |
| `rounds` | `10` |
| `outputSize` | `16` |
| `input` | `ffffffffffffffffffffffffffffffff` |
| `expected` | `b14337bb5155639ffc87bceca97894a1` |

---

[← All algorithms](../README.md)
