# DryGASCON128k16

> NIST Lightweight Cryptography finalist using DrySPONGE construction with GASCON permutation. Provides authenticated encryption with 16-byte key and protection against side-channel attacks.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Lightweight Cryptography |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Sébastien Riou, Michaël Raulet, Stéphane Castelain |
| Year | 2020 |
| Origin | Not specified |
| Source | [`algorithms/aead/gascon.js`](../../../algorithms/aead/gascon.js) |

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

- [DryGASCON GitHub Repository](https://github.com/sebastien-riou/DryGASCON)
- [NIST LWC Project Page](https://csrc.nist.gov/projects/lightweight-cryptography)
- [DryGASCON Specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/drygascon-spec-final.pdf)

## References

- [NIST LWC Round 2 Submission Package (Reference C)](https://csrc.nist.gov/projects/lightweight-cryptography/round-2-candidates)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DryGASCON128k16: Empty message, empty AAD (Count 1)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `bb857cc1cb30bd12f67fbbcc00206053` |

**Vector 2** — [DryGASCON128k16: Empty message, 1-byte AAD (Count 2)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `00` |
| `input` | _(empty)_ |
| `expected` | `fed9825ceae6ccd64cf6042fcb18628b` |

**Vector 3** — [DryGASCON128k16: Empty message, 16-byte AAD (Count 17)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `000102030405060708090a0b0c0d0e0f` |
| `input` | _(empty)_ |
| `expected` | `8d376c65983428d27d936228af47435b` |

**Vector 4** — [DryGASCON128k16: 1-byte plaintext, empty AAD (Count 34)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `00` |
| `expected` | `f249caf7dd8bd11993b3a1e63a38e8997a` |

**Vector 5** — [DryGASCON128k16: 1-byte plaintext, 1-byte AAD (Count 35)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `00` |
| `input` | `00` |
| `expected` | `51d99a58c5a70590b6cafdcfd1a0ffa8c2` |

**Vector 6** — [DryGASCON128k16: 8-byte plaintext, empty AAD (Count 265)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `0001020304050607` |
| `expected` | `f2eddab10170b930efd25f2e831d0ef375492d8733063cca` |

---

[← All algorithms](../README.md)
