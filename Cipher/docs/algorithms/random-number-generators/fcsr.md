# FCSR

> Feedback with Carry Shift Register is a pseudo-random sequence generator using arithmetic with carry instead of XOR operations. Operates in 2-adic number system with superior algebraic properties compared to LFSRs, producing maximal-length sequences with period up to 2^n-1.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Deterministic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Mark Goresky and Andrew Klapper |
| Year | 1994 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/fcsr.js`](../../../algorithms/random/fcsr.js) |

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

- [Goresky&Klapper: Feedback Registers Based on Ramified Extensions (1994)](https://link.springer.com/chapter/10.1007/3-540-58691-1_52)
- [Goresky&Klapper: Arithmetic Crosscorrelations of FCSR Sequences (1997)](https://ieeexplore.ieee.org/document/575854)
- [Klapper&Goresky: Cryptanalysis Based on 2-Adic Rational Approximation (1995)](https://link.springer.com/chapter/10.1007/3-540-44750-4_20)
- [Arnault&Berger: F-FCSR: Design of a New Class of Stream Ciphers (2005)](https://link.springer.com/chapter/10.1007/11502760_2)
- [Wikipedia: Feedback with Carry Shift Registers](https://en.wikipedia.org/wiki/Feedback_with_carry_shift_registers)

## References

- [Goresky&Klapper: Pseudo-noise sequences based on algebraic feedback shift registers (2006)](https://ieeexplore.ieee.org/document/1626204)
- [Klapper&Xu: Register synthesis for algebraic feedback shift registers (2007)](https://www.sciencedirect.com/science/article/pii/S1071579706000402)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed 0x0000000000000042: First 8 bytes - minimal seed pattern](https://link.springer.com/chapter/10.1007/3-540-58691-1_52)

| Field | Value |
| --- | --- |
| `seed` | `4200000000000000` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `4200000000000000` |

**Vector 2** — [Seed 0x0123456789ABCDEF: First 8 bytes - standard test pattern](https://link.springer.com/chapter/10.1007/3-540-58691-1_52)

| Field | Value |
| --- | --- |
| `seed` | `efcdab8967452301` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `efcdab8967452301` |

**Vector 3** — [Seed 0xFFFFFFFFFFFFFFFF: First 8 bytes - all ones seed](https://link.springer.com/chapter/10.1007/3-540-58691-1_52)

| Field | Value |
| --- | --- |
| `seed` | `ffffffffffffffff` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `ffffffffffffffff` |

**Vector 4** — [Seed 0x0123456789ABCDEF: First 16 bytes - sequence continuation](https://link.springer.com/chapter/10.1007/3-540-58691-1_52)

| Field | Value |
| --- | --- |
| `seed` | `efcdab8967452301` |
| `outputSize` | `16` |
| `input` | `null` |
| `expected` | `efcdab8967452301d7baa2e4376ff962` |

**Vector 5** — [Seed 0x8000000000000000: First 8 bytes - high bit set](https://link.springer.com/chapter/10.1007/3-540-58691-1_52)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000080` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `0000000000000080` |

**Vector 6** — [Seed 0xAAAAAAAAAAAAAAAA: First 8 bytes - alternating bit pattern](https://link.springer.com/chapter/10.1007/3-540-58691-1_52)

| Field | Value |
| --- | --- |
| `seed` | `aaaaaaaaaaaaaaaa` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `aaaaaaaaaaaaaaaa` |

**Vector 7** — [Seed 0x1111111111111111: First 8 bytes - sparse bit pattern](https://link.springer.com/chapter/10.1007/3-540-58691-1_52)

| Field | Value |
| --- | --- |
| `seed` | `1111111111111111` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `1111111111111111` |

---

[← All algorithms](../README.md)
