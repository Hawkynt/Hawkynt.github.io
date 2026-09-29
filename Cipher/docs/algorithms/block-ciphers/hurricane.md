# Hurricane

> Roman Ganin's Hurricane cipher with key-dependent 256x256 substitution matrix. Uses four-pass encryption with bidirectional matrix lookups and variable block sizes.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Roman Ganin |
| Year | 2005 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/hurricane.js`](../../../algorithms/block/hurricane.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 256 bytes (2048 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Hurricane GitHub Repository](https://github.com/rganin/hurricane)
- [Original Pascal Implementation](https://raw.githubusercontent.com/rganin/hurricane/master/Hurricane.pas)

## References

- [Hurricane Pascal Source](https://github.com/rganin/hurricane/blob/master/Hurricane.pas)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Hurricane Test Vector #1 - Single Byte](https://github.com/rganin/hurricane)

| Field | Value |
| --- | --- |
| `key` | `546573744b6579313233343536373839` |
| `input` | `00` |
| `expected` | `2c` |

**Vector 2** — [Hurricane Test Vector #2 - 8-Byte Block](https://github.com/rganin/hurricane)

| Field | Value |
| --- | --- |
| `key` | `546573744b6579313233343536373839` |
| `input` | `0011223344556677` |
| `expected` | `b8c568864292e08b` |

**Vector 3** — [Hurricane Test Vector #3 - 16-Byte Block](https://github.com/rganin/hurricane)

| Field | Value |
| --- | --- |
| `key` | `546573744b6579313233343536373839` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `cae243bb5bdba464dcfdb37df4168bb7` |

**Vector 4** — [Hurricane Test Vector #4 - ASCII Text](https://github.com/rganin/hurricane)

| Field | Value |
| --- | --- |
| `key` | `5365637265744b657931323334353637` |
| `input` | `485552524943414e45` |
| `expected` | `f7c7f40e42fb83cedf` |

---

[← All algorithms](../README.md)
