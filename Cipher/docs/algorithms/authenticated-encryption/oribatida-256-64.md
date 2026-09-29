# Oribatida-256-64

> Lightweight AEAD cipher based on SimP-256 permutation (reduced-round Simon-128-128). Features 128-bit keys, 128-bit nonces, and 128-bit tags with masked ciphertext generation. The '64' indicates 64-bit security level.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Lightweight Cryptography |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Arghya Bhattacharjee, Eik List, Cuauhtemoc Mancillas López, Mridul Nandi |
| Year | 2019 |
| Origin | 🌐 International |
| Source | [`algorithms/aead/oribatida.js`](../../../algorithms/aead/oribatida.js) |

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

- [Oribatida Official Website](https://www.isical.ac.in/~lightweight/oribatida/)
- [NIST LWC Round 2 Submission](https://csrc.nist.gov/projects/lightweight-cryptography/round-2-candidates)
- [Oribatida Specification (NIST LWC Round 2)](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/oribatida-spec-round2.pdf)

## References

- [Oribatida Reference Software Package (ISI Kolkata)](https://www.isical.ac.in/~lightweight/oribatida/oribatida_v1.zip)
- [rweather lightweight-crypto Oribatida Source](https://github.com/rweather/lightweight-crypto/tree/master/src/individual/Oribatida)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST LWC KAT Count=1: Empty plaintext, empty AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `21065eb73fff09a323253f97971a1167` |

**Vector 2** — [NIST LWC KAT Count=34: 1-byte plaintext, empty AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `00` |
| `expected` | `56f962072ac37ed49dfb53977f2092993b` |

**Vector 3** — [NIST LWC KAT Count=35: 1-byte plaintext, 1-byte AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `00` |
| `input` | `00` |
| `expected` | `2f246a9091e193f0807f525d247b352ea2` |

**Vector 4** — [NIST LWC KAT Count=50: 1-byte plaintext, 16-byte AD (full block)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00` |
| `expected` | `c9f8e6974574513fb8e5bc6bf1716fc391` |

**Vector 5** — [NIST LWC KAT Count=172: 5-byte plaintext, 6-byte AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `000102030405` |
| `input` | `0001020304` |
| `expected` | `10bec53b7c7089ee95475257f9caed015a8064e4b7` |

---

[← All algorithms](../README.md)
