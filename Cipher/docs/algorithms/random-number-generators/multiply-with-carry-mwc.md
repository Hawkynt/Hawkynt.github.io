# Multiply-with-Carry (MWC)

> George Marsaglia's lag-1 multiply-with-carry generator with base 2^32: a 64-bit state holds the current value and the carry, and each step computes x = a * (x mod 2^32) + floor(x / 2^32), returning the low 32 bits. The default multiplier 0xFFFFDA61 is the one used by javamex and Numerical Recipes.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Deterministic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | George Marsaglia |
| Year | 1991 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/mwc.js`](../../../algorithms/random/mwc.js) |

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

- [Original Paper: A new class of random number generators (1991)](https://projecteuclid.org/journals/annals-of-applied-probability/volume-1/issue-3/A-New-Class-of-Random-Number-Generators/10.1214/aoap/1177005878.full)
- [javamex: Multiply-with-carry generator in Java](https://www.javamex.com/tutorials/random_numbers/multiply_with_carry.shtml)
- [Wikipedia: Multiply-with-carry pseudorandom number generator](https://en.wikipedia.org/wiki/Multiply-with-carry_pseudorandom_number_generator)

## References

- [Numerical Recipes (3rd ed., p. 348)](http://numerical.recipes/)
- [Efficient MWC Random Number Generators with Maximal Period](https://www.math.ias.edu/~goresky/MWC.pdf)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed 1, multiplier 0xFFFFDA61: first 10 outputs](https://www.javamex.com/tutorials/random_numbers/multiply_with_carry.shtml)

| Field | Value |
| --- | --- |
| `seed` | `01000000` |
| `outputSize` | `40` |
| `multiplier` | `4294957665` |
| `input` | `null` |
| `expected` | `61daffffc1588705e3af1b01f54ae954 8eb8608c48182a2a3527b9462b0f807a 1b7afeae653fcc02` |

**Vector 2** — [Seed 12345: first 10 outputs](https://www.javamex.com/tutorials/random_numbers/multiply_with_carry.shtml)

| Field | Value |
| --- | --- |
| `seed` | `39300000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `99cfe9f83123c79b95ba2470c2a0ffa5 9cc723647902ed47beb29376e57d5b49 16578ead732e5deb` |

**Vector 3** — [Seed 0xDEADBEEF: first 10 outputs](https://www.javamex.com/tutorials/random_numbers/multiply_with_carry.shtml)

| Field | Value |
| --- | --- |
| `seed` | `efbeadde` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `8fde7d9564b855d47bce9950cb93f689 8ea017fd524115ee6e0f730b04a36330 443a0197ab973439` |

**Vector 4** — [Seed 999999999: first 16 outputs](https://www.javamex.com/tutorials/random_numbers/multiply_with_carry.shtml)

| Field | Value |
| --- | --- |
| `seed` | `ffc99a3b` |
| `outputSize` | `64` |
| `input` | `null` |
| `expected` | `9fafaa9b7bb235e159f784f81b14e04e 0f6f709833e3fd60fbdce9a80d4ecdaa 15691ee7e8e7b9b906b622aee3e0db8d 722011cb3c2b88f4567c3e3ce35fc081` |

**Vector 5** — [Value 0xDEADBEEF with carry 0x12345678: first 8 outputs](https://www.javamex.com/tutorials/random_numbers/multiply_with_carry.shtml)

| Field | Value |
| --- | --- |
| `seed` | `efbeadde78563412` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `0735b2a7dcab54f5be92440bcded870cc43d799d393b4db83821f2fb5b661d3e` |

**Vector 6** — [Fixed point: value 2^32 - 1 with carry a - 1 (largest carry) repeats](https://en.wikipedia.org/wiki/Multiply-with-carry_pseudorandom_number_generator)

| Field | Value |
| --- | --- |
| `seed` | `ffffffff60daffff` |
| `outputSize` | `16` |
| `input` | `null` |
| `expected` | `ffffffffffffffffffffffffffffffff` |

---

[← All algorithms](../README.md)
