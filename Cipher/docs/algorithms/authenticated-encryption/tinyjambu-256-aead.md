# TinyJAMBU-256 AEAD

> Lightweight authenticated encryption finalist in NIST LWC. Features 256-bit keyed permutation with 4-word state, 96-bit nonce, and 64-bit authentication tag. Optimized for constrained environments.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Lightweight Cryptography |
| Variant | 256 |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Hongjun Wu, Tao Huang |
| Year | 2019 |
| Origin | 🌐 International |
| Source | [`algorithms/aead/tinyjambu.js`](../../../algorithms/aead/tinyjambu.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
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

**Vector 1** — [TinyJAMBU-256: Empty message, empty AAD (Count 1)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `9b04ed416f7d7f56` |

**Vector 2** — [TinyJAMBU-256: Empty message with 1-byte AAD (Count 2)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b` |
| `aad` | `00` |
| `input` | _(empty)_ |
| `expected` | `a68d4c7689096558` |

**Vector 3** — [TinyJAMBU-256: Empty message with 4-byte AAD (Count 5)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b` |
| `aad` | `00010203` |
| `input` | _(empty)_ |
| `expected` | `90f1ace82c4c5ffe` |

**Vector 4** — [TinyJAMBU-256: 1-byte message, empty AAD (Count 34)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b` |
| `aad` | _(empty)_ |
| `input` | `00` |
| `expected` | `0fe90a41b4aa18329f` |

**Vector 5** — [TinyJAMBU-256: 1-byte message with 1-byte AAD (Count 35)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b` |
| `aad` | `00` |
| `input` | `00` |
| `expected` | `20bb303279c2739ce5` |

**Vector 6** — [TinyJAMBU-256: 4-byte message with 4-byte AAD (Count 137)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b` |
| `aad` | `00010203` |
| `input` | `00010203` |
| `expected` | `0243655595b82f3b398f3d96` |

**Vector 7** — [TinyJAMBU-256: 8-byte message with 32-byte AAD (Count 297)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b` |
| `aad` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `0001020304050607` |
| `expected` | `a5628df713d4316218a127fc09046f81` |

---

[← All algorithms](../README.md)
