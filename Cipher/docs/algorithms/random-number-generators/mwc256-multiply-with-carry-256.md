# MWC256 (Multiply-with-Carry 256)

> MWC256 is a multiply-with-carry generator with 256 32-bit elements invented by George Marsaglia. It achieves an extraordinary period of approximately 2^8222 through an array-based MWC approach. Known for excellent statistical properties and efficiency in embedded systems.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Multiply-With-Carry |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | George Marsaglia |
| Year | 2003 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/mwc256.js`](../../../algorithms/random/mwc256.js) |

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

- [Marsaglia's comp.lang.c Post (May 13, 2003) - MWC256 Reference Implementation](https://groups.google.com/g/comp.lang.c/c/qZFQgKRCQGg)
- [Wikipedia: Multiply-with-carry pseudorandom number generator](https://en.wikipedia.org/wiki/Multiply-with-carry_pseudorandom_number_generator)
- [Marsaglia's sci.math Post (Feb 25, 2003) - MWC256 Original Announcement](https://groups.google.com/g/sci.math/c/k3kVM8KwR-s)
- [Modern C Implementation of MWC256 (GitHub)](https://github.com/HugoDaniel/mwc)

## References

- [Distribution Properties of MWC Generators](https://www.ams.org/journals/mcom/1997-66-218/S0025-5718-97-00827-2/)
- [Haskell mwc-random Package (MWC256 implementation)](https://hackage.haskell.org/package/mwc-random)
- [TestU01 Statistical Testing Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Seed 0: First 5 outputs (20 bytes) - verified against C reference

Source: X:\Coding\Working Copies\Hawkynt.git\Hawkynt.github.io\Cipher\generate_mwc256_vectors.c

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `853985dd4d44ad486eb3d35a389c85df4dab581a` |

**Vector 2** — Seed 1: First 5 outputs (20 bytes)

Source: X:\Coding\Working Copies\Hawkynt.git\Hawkynt.github.io\Cipher\verify_mwc256.c

| Field | Value |
| --- | --- |
| `seed` | `0000000000000001` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `abbf7382b9c63de8072c39b1e81359e13fc9883b` |

**Vector 3** — Seed 42: First 5 outputs (20 bytes)

Source: X:\Coding\Working Copies\Hawkynt.git\Hawkynt.github.io\Cipher\verify_mwc256.c

| Field | Value |
| --- | --- |
| `seed` | `000000000000002a` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `03595d70f2fbe6a89e8aa771ba8da0dfe712ebdd` |

**Vector 4** — Seed 1234567: First 8 outputs (32 bytes)

Source: X:\Coding\Working Copies\Hawkynt.git\Hawkynt.github.io\Cipher\verify_mwc256.c

| Field | Value |
| --- | --- |
| `seed` | `000000000012d687` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `63b2d6ee7ddc289bf248367e4ce3d7ccab2b932c118e6002cea2fcaaea750b8b` |

**Vector 5** — Seed 987654321: First 8 outputs (32 bytes)

Source: X:\Coding\Working Copies\Hawkynt.git\Hawkynt.github.io\Cipher\verify_mwc256.c

| Field | Value |
| --- | --- |
| `seed` | `000000003ade68b1` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `996730de7c9749be79d140f50648de5cd4a6c28bf4bff9ba2884ec73ba3f879d` |

---

[← All algorithms](../README.md)
