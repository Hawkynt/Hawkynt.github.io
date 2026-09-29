# Subtract-with-Borrow (SWB)

> Subtract-with-Borrow is a lagged Fibonacci generator with borrow propagation, invented by George Marsaglia and Arif Zaman in 1991. It uses the formula X[n] = (X[n-r] - X[n-s] - borrow) mod m with very long periods. Fast and memory-efficient but not cryptographically secure.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Deterministic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | George Marsaglia, Arif Zaman |
| Year | 1991 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/swb.js`](../../../algorithms/random/swb.js) |

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

- [Original Paper: A New Class of Random Number Generators (1991)](https://projecteuclid.org/journals/annals-of-applied-probability/volume-1/issue-3/A-New-Class-of-Random-Number-Generators/10.1214/aoap/1177005878.full)
- [ResearchGate: A New Class of Random Number Generators](https://www.researchgate.net/publication/38363004_A_New_Class_of_Random_Number_Generators)
- [Wikipedia: Subtract with carry](https://en.wikipedia.org/wiki/Subtract_with_carry)
- [C++ Standard Library: std::subtract_with_carry_engine](https://en.cppreference.com/w/cpp/numeric/random/subtract_with_carry_engine)

## References

- [Analysis of add-with-carry and subtract-with-borrow generators](https://www.researchgate.net/publication/221529552_Analysis_of_add-with-carry_and_subtract-with-borrow_generators)
- [On the Lattice Structure of AWC and SWB Generators](https://www.researchgate.net/publication/220136420_On_the_Lattice_Structure_of_the_Add-With-Carry_and_Subtract-With-Borrow_Random_Number_Generators)
- [A revision of the subtract-with-borrow random number generators (2017)](https://arxiv.org/abs/1705.03123)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed 0: First 5 outputs (40 bytes) - SWB(4096, 63, 4093)](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `0ae12fad109b1c4f2c056fc4220a91de ec4507a4021b9a03696a25d23a3110f8 89863a39432da426` |

**Vector 2** — [Seed 1: First 5 outputs (40 bytes) - SWB(4096, 63, 4093)](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000001` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `0a16558aa58099ff7d054668d25edd7c ebf95bd8080aa072eeba28ca7d12fa3e 9e5d5de2489093e8` |

**Vector 3** — [Seed 42: First 5 outputs (40 bytes) - SWB(4096, 63, 4093)](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `000000000000002a` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `ca13722c11ad56177a83a92bd6180b4f 00af31bd582568005355dd85a78be3ac aae02192b3f6f5c4` |

**Vector 4** — [Seed 1234567: First 5 outputs (40 bytes) - SWB(4096, 63, 4093)](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `000000000012d687` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `5e5e874a13cc0ad40d0991c3e2bc9b05 0c3ff517b5ac3f3d44bb3d0dd6f5bdcb fbb7439b68b88be2` |

**Vector 5** — [Seed 987654321: First 5 outputs (40 bytes) - SWB(4096, 63, 4093)](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `000000003ade68b1` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `268b7f5cee02de79c44e6685e70d7b94 c080778ed8a1656da915af8bc016f7cd 189c9cccb3c90502` |

---

[← All algorithms](../README.md)
