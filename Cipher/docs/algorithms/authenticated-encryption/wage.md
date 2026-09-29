# WAGE

> WAGE authenticated encryption algorithm with 259-bit permutation, NIST LWC Round 2 finalist. Features WG permutation and parallel S-box operations for lightweight applications.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Yalijiang Yang, Zhongming Wu, Xinxin Fan |
| Year | 2019 |
| Origin | 🇨🇳 China |
| Source | [`algorithms/aead/wage.js`](../../../algorithms/aead/wage.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Tag sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [WAGE Official Page](https://uwaterloo.ca/communications-security-lab/lwc/wage)
- [NIST LWC Round 2](https://csrc.nist.gov/Projects/lightweight-cryptography)

## References

- [rweather/lightweight-crypto C Reference Implementation](https://github.com/rweather/lightweight-crypto)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST KAT Vector #1 (empty PT, empty AD)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `0466697cc97cdb5604bc6f6b5cba9014` |

**Vector 2** — [NIST KAT Vector #2 (empty PT, 1-byte AD)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `00` |
| `input` | _(empty)_ |
| `expected` | `afea3a5c7c215d819f028fc060e0b010` |

**Vector 3** — [NIST KAT Vector #9 (empty PT, 8-byte AD)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `0001020304050607` |
| `input` | _(empty)_ |
| `expected` | `4b4819c8cf89d87e90e1dc6ad863193c` |

**Vector 4** — [NIST KAT Vector #17 (empty PT, 16-byte AD)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `000102030405060708090a0b0c0d0e0f` |
| `input` | _(empty)_ |
| `expected` | `49280eff5a89236f9b53c30b89c936ee` |

**Vector 5** — [NIST KAT Vector #34 (1-byte PT, empty AD)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | `00` |
| `expected` | `a4c7f41212ee54ffc71dee47e69dcd01e5` |

**Vector 6** — [NIST KAT Vector #35 (1-byte PT, 1-byte AD)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `00` |
| `input` | `00` |
| `expected` | `9c09707bb8edba95afe9c26f607c3b6b2d` |

**Vector 7** — [NIST KAT Vector #42 (1-byte PT, 8-byte AD)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `0001020304050607` |
| `input` | `00` |
| `expected` | `6af94f77ae28c9bfcc719c771878689097` |

**Vector 8** — [NIST KAT Vector #50 (1-byte PT, 16-byte AD)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00` |
| `expected` | `4893485dc4caa674b39b9007b43d1c67e7` |

---

[← All algorithms](../README.md)
