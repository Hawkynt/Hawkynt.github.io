# TinyJAMBU-128 AEAD

> Lightweight authenticated encryption finalist in NIST LWC. Features 128-bit keyed permutation with 4-word state, 96-bit nonce, and 64-bit authentication tag. Optimized for constrained environments.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Lightweight Cryptography |
| Variant | 128 |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Hongjun Wu, Tao Huang |
| Year | 2019 |
| Origin | 🇨🇳 China |
| Source | [`algorithms/aead/tinyjambu.js`](../../../algorithms/aead/tinyjambu.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Tag sizes | 8 bytes (64 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST LWC Finalist Specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/tinyjambu-spec-final.pdf)
- [NIST Lightweight Cryptography Project](https://csrc.nist.gov/projects/lightweight-cryptography)

## References

- [rweather/TinyJAMBU Official-Author-Adjacent Reference (C)](https://github.com/rweather/TinyJAMBU)
- [rweather/lwc-finalists C Reference (embedded-optimized)](https://github.com/rweather/lwc-finalists)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [TinyJAMBU-128: Empty message, empty AAD (Count 1)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `7c5456e109b55a3a` |

**Vector 2** — [TinyJAMBU-128: Empty message with 1-byte AAD (Count 2)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `aad` | `00` |
| `input` | _(empty)_ |
| `expected` | `607dfb91ae92d187` |

**Vector 3** — [TinyJAMBU-128: Empty message with 4-byte AAD (Count 5)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `aad` | `00010203` |
| `input` | _(empty)_ |
| `expected` | `f7a293db3fb16464` |

**Vector 4** — [TinyJAMBU-128: 1-byte message, empty AAD (Count 34)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `aad` | _(empty)_ |
| `input` | `00` |
| `expected` | `02a5b193ad5739203e` |

**Vector 5** — [TinyJAMBU-128: 1-byte message with 1-byte AAD (Count 35)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `aad` | `00` |
| `input` | `00` |
| `expected` | `cab4391f64177f8c2b` |

**Vector 6** — [TinyJAMBU-128: 4-byte message with 4-byte AAD (Count 137)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `aad` | `00010203` |
| `input` | `00010203` |
| `expected` | `362bc344c45c165ceca7fd82` |

**Vector 7** — [TinyJAMBU-128: 8-byte message with 8-byte AAD (Count 273)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `aad` | `0001020304050607` |
| `input` | `0001020304050607` |
| `expected` | `c7d6a4d8244a54636022d9e7ab0a0673` |

---

[← All algorithms](../README.md)
