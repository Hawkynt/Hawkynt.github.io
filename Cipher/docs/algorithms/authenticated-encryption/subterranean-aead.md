# Subterranean AEAD

> Minimalist duplex sponge AEAD construction with 257-bit permutation. NIST LWC Round 2 candidate designed for hardware efficiency.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Lightweight Cryptography |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Joan Daemen, Pedro Maat Costa Massolino, Yann Rotella |
| Year | 2019 |
| Origin | Not specified |
| Source | [`algorithms/aead/subterranean.js`](../../../algorithms/aead/subterranean.js) |

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

- [Subterranean 2.0 Specification](https://cs.ru.nl/~joan/subterranean.html)
- [NIST LWC Submission](https://csrc.nist.gov/projects/lightweight-cryptography/round-2-candidates)

## References

- [rweather/lightweight-crypto C Reference Implementation](https://github.com/rweather/lightweight-crypto)
- [pmassolino/hw-subterranean (designer-affiliated, incl. Python reference)](https://github.com/pmassolino/hw-subterranean)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Subterranean: Empty message, empty AAD (Count 1)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `119838e888c950cdb651e73e1be37cfb` |

**Vector 2** — [Subterranean: Empty message, 1-byte AAD (Count 2)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `00` |
| `input` | _(empty)_ |
| `expected` | `70ed5336da2ee7a99bae0ce68832fe0e` |

**Vector 3** — [Subterranean: Empty message, 4-byte AAD (Count 5)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `00010203` |
| `input` | _(empty)_ |
| `expected` | `3239852bc3478b82edb25c47f6c13ece` |

**Vector 4** — [Subterranean: 1-byte plaintext, empty AAD (Count 44)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `00` |
| `expected` | `5fabceade76378ea5e2f79f0b5417eb3d5` |

**Vector 5** — [Subterranean: 4-byte plaintext, empty AAD (Count 133)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `00010203` |
| `expected` | `5fae2772e4148412d4479a84f6a0b20ec8e4429b` |

**Vector 6** — [Subterranean: 16-byte plaintext, 8-byte AAD (Count 537)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `0001020304050607` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `52b608b5e28e649b680c7b9b6c7dacd5c839da24570162f6b6f401ce1ff020d9` |

---

[← All algorithms](../README.md)
