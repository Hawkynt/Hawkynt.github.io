# TinyJAMBU-192 AEAD

> Lightweight authenticated encryption finalist in NIST LWC. Features 192-bit keyed permutation with 4-word state, 96-bit nonce, and 64-bit authentication tag. Optimized for constrained environments.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Lightweight Cryptography |
| Variant | 192 |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Hongjun Wu, Tao Huang |
| Year | 2019 |
| Origin | 🌐 International |
| Source | [`algorithms/aead/tinyjambu.js`](../../../algorithms/aead/tinyjambu.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 24 bytes (192 bits) |
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

**Vector 1** — [TinyJAMBU-192: Empty message, empty AAD (Count 1)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `nonce` | `000102030405060708090a0b` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `7a0775b5021a22a6` |

**Vector 2** — [TinyJAMBU-192: Empty message with 1-byte AAD (Count 2)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `nonce` | `000102030405060708090a0b` |
| `aad` | `00` |
| `input` | _(empty)_ |
| `expected` | `ce89a55740c8b4e3` |

**Vector 3** — [TinyJAMBU-192: Empty message with 4-byte AAD (Count 5)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `nonce` | `000102030405060708090a0b` |
| `aad` | `00010203` |
| `input` | _(empty)_ |
| `expected` | `bb87c0583a6dd75a` |

**Vector 4** — [TinyJAMBU-192: 1-byte message, empty AAD (Count 34)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `nonce` | `000102030405060708090a0b` |
| `aad` | _(empty)_ |
| `input` | `00` |
| `expected` | `6017f2d006dcc66569` |

**Vector 5** — [TinyJAMBU-192: 1-byte message with 1-byte AAD (Count 35)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `nonce` | `000102030405060708090a0b` |
| `aad` | `00` |
| `input` | `00` |
| `expected` | `803a2659c516b939ab` |

**Vector 6** — [TinyJAMBU-192: 4-byte message with 4-byte AAD (Count 137)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `nonce` | `000102030405060708090a0b` |
| `aad` | `00010203` |
| `input` | `00010203` |
| `expected` | `ec0f17ade4456f9a644d5fc2` |

**Vector 7** — [TinyJAMBU-192: 8-byte message with 32-byte AAD (Count 297)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `nonce` | `000102030405060708090a0b` |
| `aad` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `0001020304050607` |
| `expected` | `813ca1b8aa61e2a8951d73f7b2d03bb3` |

---

[← All algorithms](../README.md)
