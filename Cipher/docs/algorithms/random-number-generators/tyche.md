# Tyche

> Fast cryptographic PRNG based on 20-round ChaCha cipher designed by Samuel Neves and Filipe Araujo (2011). Tyche passes PractRand and TestU01 BigCrush statistical test suites. Uses ChaCha quarter-round function with different initialization than standard ChaCha20.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Pseudorandom Number Generator |
| Variant | Tyche |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Samuel Neves, Filipe Araujo |
| Year | 2011 |
| Origin | Not specified |
| Source | [`algorithms/random/chacha.js`](../../../algorithms/random/chacha.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 32 bytes (256 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | Yes |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [Tyche: Fast and Small Nonlinear Pseudorandom Number Generators (PPAM 2011)](https://eden.dei.uc.pt/~sneves/pubs/2011-snfa2.pdf)
- [ChaCha: A variant of Salsa20](https://cr.yp.to/chacha/chacha-20080128.pdf)
- [Cryptography StackExchange: Tyche vs ChaCha](https://crypto.stackexchange.com/questions/28503/what-is-the-difference-between-tyche-and-chacha)

## References

- [Go runtime PRNG source code (ChaCha8)](https://github.com/golang/go/blob/master/src/runtime/rand.go)
- [Rust rand_chacha crate](https://docs.rs/rand_chacha/)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Tyche with seed 0, stream 0: First 16 bytes](https://github.com/Shiroechi/Litdex.Security.RNG/blob/main/Source/Security/RNG/PRNG/Tyche.cs)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `streamIndex` | `00000000` |
| `outputSize` | `16` |
| `input` | `null` |
| `expected` | `dbdcae836fde31bf714be8aba4b974ff` |

**Vector 2** — [Tyche with seed 1, stream 0: First 16 bytes](https://github.com/Shiroechi/Litdex.Security.RNG/blob/main/Source/Security/RNG/PRNG/Tyche.cs)

| Field | Value |
| --- | --- |
| `seed` | `0100000000000000` |
| `streamIndex` | `00000000` |
| `outputSize` | `16` |
| `input` | `null` |
| `expected` | `abbf5598b056862844653ebd5aa86b9c` |

**Vector 3** — [Tyche with seed 12345, stream 0: First 16 bytes](https://github.com/Shiroechi/Litdex.Security.RNG/blob/main/Source/Security/RNG/PRNG/Tyche.cs)

| Field | Value |
| --- | --- |
| `seed` | `3930000000000000` |
| `streamIndex` | `00000000` |
| `outputSize` | `16` |
| `input` | `null` |
| `expected` | `d7d0722e34863050d14334a5877d014c` |

**Vector 4** — [Tyche with seed 0xDEADBEEF, stream 1: First 16 bytes](https://github.com/Shiroechi/Litdex.Security.RNG/blob/main/Source/Security/RNG/PRNG/Tyche.cs)

| Field | Value |
| --- | --- |
| `seed` | `efbeadde00000000` |
| `streamIndex` | `01000000` |
| `outputSize` | `16` |
| `input` | `null` |
| `expected` | `8e24dfdb18a1d74d5bdf1e9d5b5585fc` |

---

[← All algorithms](../README.md)
