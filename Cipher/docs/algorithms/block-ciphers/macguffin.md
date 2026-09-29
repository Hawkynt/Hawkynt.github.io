# MacGuffin

> Experimental block cipher using Generalized Unbalanced Feistel Network (GUFN) where each round modifies 16 bits based on 48 bits. Broken by differential cryptanalysis at the same workshop where it was introduced.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | ❌ Broken |
| Complexity | Intermediate |
| Inventor | Bruce Schneier, Matt Blaze |
| Year | 1994 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/macguffin.js`](../../../algorithms/block/macguffin.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Differential Cryptanalysis](https://link.springer.com/chapter/10.1007/3-540-60590-8_27) | Broken by Vincent Rijmen and Bart Preneel at FSE '94 (same workshop). 32 rounds weaker than 16 rounds of DES. | — |

## Documentation

- [Original Paper (Schneier.com)](https://www.schneier.com/academic/archives/1995/01/the_macguffin_block.html)
- [FSE '94 Proceedings (Springer)](https://link.springer.com/chapter/10.1007/3-540-60590-8_8)
- [Wikipedia Article](https://en.wikipedia.org/wiki/MacGuffin_(cipher))

## References

- [Cryptanalysis Paper (Rijmen, Preneel)](https://www.researchgate.net/publication/2748370_Cryptanalysis_of_McGuffin)
- [Springer Cryptanalysis](https://link.springer.com/chapter/10.1007/3-540-60590-8_27)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [FSE '94 reference implementation - all-zero key and plaintext](https://www.schneier.com/wp-content/uploads/2016/02/paper-macguffin.pdf)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `a560ae037fdc2db4` |

**Vector 2** — [FSE '94 reference implementation - sequential key, zero plaintext](https://www.schneier.com/wp-content/uploads/2016/02/paper-macguffin.pdf)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0000000000000000` |
| `expected` | `c276abc201a557d2` |

**Vector 3** — [FSE '94 reference implementation - sequential key and plaintext](https://www.schneier.com/wp-content/uploads/2016/02/paper-macguffin.pdf)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001020304050607` |
| `expected` | `ddd524724dab18e8` |

**Vector 4** — [FSE '94 reference implementation - all-ones plaintext](https://www.schneier.com/wp-content/uploads/2016/02/paper-macguffin.pdf)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdeffedcba9876543210` |
| `input` | `ffffffffffffffff` |
| `expected` | `3bdfbd66105c3664` |

**Vector 5** — [FSE '94 reference implementation - two blocks](https://www.schneier.com/wp-content/uploads/2016/02/paper-macguffin.pdf)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `ddd524724dab18e8d1279a0e3d850d10` |

---

[← All algorithms](../README.md)
