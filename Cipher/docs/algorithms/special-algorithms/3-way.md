# 3-Way

> Block cipher designed by Joan Daemen in 1994 with unique 96-bit blocks and keys. Features elegant self-inverse properties and matrix operations that influenced AES design.

## Properties

| Property | Value |
| --- | --- |
| Category | Special Algorithms |
| Sub-category | Block Cipher |
| Security status | ❌ Broken |
| Complexity | Intermediate |
| Inventor | Joan Daemen |
| Year | 1994 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/special/3way.js`](../../../algorithms/special/3way.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 12 bytes (96 bits) |
| Block sizes | 12 bytes (96 bits) |

## Security

**Status:** ❌ Broken

No vulnerabilities are recorded for this implementation.

## Documentation

- [Original 3-Way Paper](https://link.springer.com/chapter/10.1007/3-540-58108-1_24)
- [Applied Cryptography Description](https://www.schneier.com/academic/archives/1996/01/unbalanced_feistel_n.html)

## References

- [3-Way Analysis](https://en.wikipedia.org/wiki/3-Way)
- [Joan Daemen's Work](https://www.cosic.esat.kuleuven.be/)
- [Pate Williams](https://www.schneier.com/wp-content/uploads/2015/03/3-WAY-2.zip)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — 3-Way Educational Test - All Zeros (Forward Only)

Source: Educational implementation test vector

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000` |
| `input` | `000000000000000000000000` |
| `expected` | `ffffffffffffffff00000000` |

**Vector 2** — 3-Way Educational Test - Pattern (Forward Only)

Source: Educational implementation test vector

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdef01234567` |
| `input` | `fedcba9876543210fedcba98` |
| `expected` | `18941cd4404040401cd05894` |

---

[← All algorithms](../README.md)
