# LOCUS-AEAD

> Lightweight authenticated encryption with 128-bit keys, 128-bit nonces, and 64-bit tags. Uses GIFT-64 tweakable block cipher with COFB-style mode. Optimized for constrained environments.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | GIFT Team (Banik, Pandey, Peyrin, Sasaki, Sim, Todo) |
| Year | 2019 |
| Origin | 🌐 International |
| Source | [`algorithms/aead/locus-aead.js`](../../../algorithms/aead/locus-aead.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 16 bytes (128 bits) |
| Tag sizes | 8 bytes (64 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST LWC Submission](https://csrc.nist.gov/Projects/lightweight-cryptography)
- [GIFT Specification](https://eprint.iacr.org/2017/622.pdf)
- [Reference Implementation](https://github.com/rweather/lightweight-crypto)

## References

- [LOTUS-AEAD and LOCUS-AEAD NIST LWC Round 1 Submission Package (Reference C Code)](https://csrc.nist.gov/CSRC/media/Projects/Lightweight-Cryptography/documents/round-1/submissions/lotus-locus.zip)
- [LOTUS/LOCUS Official Project Page (ISI Kolkata)](https://www.isical.ac.in/~lightweight/lotus/)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [LOCUS-AEAD Vector #1: Empty PT and AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `37f3ebb83ff38de8` |

**Vector 2** — [LOCUS-AEAD Vector #34: 1-byte PT, empty AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `00` |
| `expected` | `03dc889adc2b53ec2a` |

**Vector 3** — [LOCUS-AEAD Vector #100: 3-byte PT, empty AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `000102` |
| `expected` | `f0381683c1937f51c16ee7` |

**Vector 4** — [LOCUS-AEAD Vector #300: 8-byte PT, 2-byte AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `0001` |
| `input` | `000102030405060708` |
| `expected` | `b3015dca2a2b544f0bfa5d08d3f2f71f86` |

**Vector 5** — [LOCUS-AEAD Vector #1007: 29-byte PT, 16-byte AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d` |
| `expected` | `b3015dca2a2b544f2b37c2018bf764f8 2e4497fcc0a066688b5a78d55a0bc749 353d0b8ac5de` |

---

[← All algorithms](../README.md)
