# SpoC-64

> Lightweight AEAD using sLiSCP-light-192 permutation with 64-bit tag. Primary SpoC variant optimized for minimal hardware implementation.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | AEAD Cipher |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Kalikinkar Mandal, Dhiman Saha |
| Year | 2019 |
| Origin | 🌐 International |
| Source | [`algorithms/aead/spoc.js`](../../../algorithms/aead/spoc.js) |

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

- [SpoC Specification](https://uwaterloo.ca/communications-security-lab/lwc/spoc)
- [NIST LWC Round 2 Package](https://csrc.nist.gov/projects/lightweight-cryptography/round-2-candidates)

## References

- [rweather/lightweight-crypto C Reference Implementation](https://github.com/rweather/lightweight-crypto)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST LWC KAT Vector #1 - Empty plaintext and AD](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SpoC-64.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `1b8e3d0312362a22` |

**Vector 2** — [NIST LWC KAT Vector #2 - Empty plaintext with single AD byte](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SpoC-64.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `00` |
| `input` | _(empty)_ |
| `expected` | `e314f8572d6d1995` |

**Vector 3** — [NIST LWC KAT Vector #34 - Single plaintext byte, empty AD](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SpoC-64.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | `00` |
| `expected` | `d54568591ab6696c94` |

**Vector 4** — [NIST LWC KAT Vector #169 - 5-byte plaintext with 3-byte AD (partial rate block)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SpoC-64.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `000102` |
| `input` | `0001020304` |
| `expected` | `f4b88fa2fe94e80ba2a4a55708` |

**Vector 5** — [NIST LWC KAT Vector #1089 - 32-byte plaintext with 32-byte AD (multiple full rate blocks)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SpoC-64.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `5d1f88d2d4cceb47c921ebcd717b689b 1dc86a640c72c1022350e05fb91282fe b4fbde5f34a15ca0` |

---

[← All algorithms](../README.md)
