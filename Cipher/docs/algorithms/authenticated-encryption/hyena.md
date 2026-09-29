# HYENA

> NIST Lightweight Cryptography candidate combining GIFT-128 nibble-based cipher with efficient AEAD construction. Uses sponge-like mode with delta values for authenticated encryption.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Subhadeep Banik, Khashayar Barooti, Fatih Balli, Andrea Caforio, F. Betül Durak, Serge Vaudenay |
| Year | 2020 |
| Origin | 🌐 International |
| Source | [`algorithms/aead/hyena.js`](../../../algorithms/aead/hyena.js) |

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

- [NIST LWC Submission](https://csrc.nist.gov/Projects/lightweight-cryptography)
- [HYENA Specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/hyena-spec-round2.pdf)
- [Reference Implementation](https://github.com/rweather/lightweight-crypto)
- [GIFT Cipher](https://giftcipher.github.io/gift/)

## References

- [HYENA Reference Software Package (ISI Kolkata)](https://www.isical.ac.in/~lightweight/hyena/hyena.zip)
- [rweather lightweight-crypto HYENA Source](https://github.com/rweather/lightweight-crypto/tree/master/src/individual/HYENA)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST LWC KAT Count 1 (empty PT, empty AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/HYENA-v1.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `f83ca141a233342b1507192f171774a6` |

**Vector 2** — [NIST LWC KAT Count 2 (empty PT, 1-byte AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/HYENA-v1.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `associatedData` | `00` |
| `input` | _(empty)_ |
| `expected` | `e350763873b36471681989e03cdfb4be` |

**Vector 3** — [NIST LWC KAT Count 3 (empty PT, 2-byte AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/HYENA-v1.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `associatedData` | `0001` |
| `input` | _(empty)_ |
| `expected` | `9a9914d7a8cdfedb8a688be6db7d214f` |

**Vector 4** — [NIST LWC KAT Count 17 (empty PT, 16-byte AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/HYENA-v1.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `associatedData` | `000102030405060708090a0b0c0d0e0f` |
| `input` | _(empty)_ |
| `expected` | `50a5c6abba4ce9171452107468ade5ae` |

**Vector 5** — [NIST LWC KAT Count 34 (1-byte PT, empty AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/HYENA-v1.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `associatedData` | _(empty)_ |
| `input` | `00` |
| `expected` | `3562c0cac7e1f43e1b2fa4d8addbf15c3f` |

**Vector 6** — [NIST LWC KAT Count 35 (1-byte PT, 1-byte AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/HYENA-v1.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `associatedData` | `00` |
| `input` | `00` |
| `expected` | `a79e7781a6274290d22a1a52590920ee64` |

---

[← All algorithms](../README.md)
