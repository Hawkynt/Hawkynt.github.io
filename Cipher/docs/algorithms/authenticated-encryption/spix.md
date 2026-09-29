# SPIX

> Lightweight AEAD cipher using MonkeyDuplex construction with sLiSCP-light-256 permutation. Features 128-bit key/nonce/tag with 8-byte rate for efficient authenticated encryption.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Lightweight Cryptography |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Tao Huang, Junjie Bi, Zhenzhen Bao, Jiale Guo |
| Year | 2019 |
| Origin | 🌐 International |
| Source | [`algorithms/aead/spix.js`](../../../algorithms/aead/spix.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 16 bytes (128 bits) |
| Tag sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [SPIX Specification](https://uwaterloo.ca/communications-security-lab/lwc/spix)
- [NIST LWC Project](https://csrc.nist.gov/projects/lightweight-cryptography)

## References

- [rweather/lightweight-crypto C Reference Implementation](https://github.com/rweather/lightweight-crypto)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SPIX: Empty message, empty AAD (Count 1)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `74d5a923739b1f893c7c005df8349b62` |

**Vector 2** — [SPIX: Empty message, 1-byte AAD (Count 2)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `00` |
| `input` | _(empty)_ |
| `expected` | `8206dfcb92d667f617328ebcc6a38ac9` |

**Vector 3** — [SPIX: Empty message, 2-byte AAD (Count 3)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `0001` |
| `input` | _(empty)_ |
| `expected` | `a012ddf1716623239f7813d122c7c42c` |

**Vector 4** — [SPIX: 1-byte plaintext, empty AAD (Count 34)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `00` |
| `expected` | `2a071d7de31a45dddad7d2b3086e41950f` |

---

[← All algorithms](../README.md)
