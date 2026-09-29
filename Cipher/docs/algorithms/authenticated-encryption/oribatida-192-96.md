# Oribatida-192-96

> Lightweight AEAD cipher based on SimP-192 permutation (reduced-round Simon-96-96). Features 128-bit keys, 64-bit nonces, and 96-bit tags with masked ciphertext generation. Optimized for constrained environments.

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
| Nonce sizes | 8 bytes (64 bits) |
| Tag sizes | 12 bytes (96 bits) |

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
| `nonce` | `0001020304050607` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `83dcc3e7df9986adc38358cd` |

**Vector 2** — [NIST LWC KAT Count=2: Empty plaintext, 1-byte AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `0001020304050607` |
| `aad` | `00` |
| `input` | _(empty)_ |
| `expected` | `2ca7f3d7ac0074e649a768a5` |

**Vector 3** — [NIST LWC KAT Count=46: 1-byte plaintext, 12-byte AD (full rate block)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `0001020304050607` |
| `aad` | `000102030405060708090a0b` |
| `input` | `00` |
| `expected` | `5df32fd38e0d3e2a6482dd055d` |

**Vector 4** — [NIST LWC KAT Count=18: 0-byte plaintext, 13-byte AD (partial rate block)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `0001020304050607` |
| `aad` | `000102030405060708090a0b0c0d0e0f10` |
| `input` | _(empty)_ |
| `expected` | `685c11ca5529e306030fd98f` |

**Vector 5** — [NIST LWC KAT Count=403: 12-byte plaintext (full rate block), 6-byte AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `0001020304050607` |
| `aad` | `000102030405` |
| `input` | `000102030405060708090a0b` |
| `expected` | `a1315d1f07aa2b5bfa676b5cbed7374a962cd217373cce64` |

---

[← All algorithms](../README.md)
