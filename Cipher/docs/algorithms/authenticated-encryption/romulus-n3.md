# Romulus-N3

> Romulus variant with 96-bit nonce using SKINNY-128-256. Lightweight version with reduced tweakey size.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | Tetsu Iwata, Mustafa Khairallah, Kazuhiko Minematsu, Thomas Peyrin |
| Year | 2019 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/aead/romulus.js`](../../../algorithms/aead/romulus.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Tag sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [Romulus Official Site](https://romulusae.github.io/romulus/)

## References

- [Romulus Reference Implementation (romulusae/romulus, GitHub)](https://github.com/romulusae/romulus)
- [NIST LWC Finalist Submissions Archive](https://csrc.nist.gov/Projects/lightweight-cryptography/finalists)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Romulus-N3 NIST LWC KAT Count=1 (empty message, empty AD)](https://github.com/romulusae/romulus/blob/master/Implementations/software/ref/Previous%20Romulus%20versions/Romulus-N3/LWC_AEAD_KAT_128_96.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `8f13641c9eb6c1307c40947e0326d8f2` |

**Vector 2** — [Romulus-N3 NIST LWC KAT Count=102 (3-byte message, 2-byte AD)](https://github.com/romulusae/romulus/blob/master/Implementations/software/ref/Previous%20Romulus%20versions/Romulus-N3/LWC_AEAD_KAT_128_96.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `associatedData` | `0001` |
| `input` | `000102` |
| `expected` | `fe9d36b78af5cc41d79b956c2a41ab44f9fca1` |

**Vector 3** — [Romulus-N3 NIST LWC KAT Count=545 (16-byte message, 16-byte AD)](https://github.com/romulusae/romulus/blob/master/Implementations/software/ref/Previous%20Romulus%20versions/Romulus-N3/LWC_AEAD_KAT_128_96.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `associatedData` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `0f47f3b0c630fe59005875d996fa1207eca4083541524376886cd1db30016b2c` |

---

[← All algorithms](../README.md)
